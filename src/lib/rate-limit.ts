/**
 * r69 (audit ⑥) — DB-backed rate limiting for the employee PIN sign-in.
 *
 * The r68 audit flagged that /api/auth/employee had no rate limiting at
 * all: the PIN space is 10,000 codes, so a scripted client could
 * brute-force every employee PIN in minutes.
 *
 * Design notes:
 *  - DB-backed (not in-memory) so the limit is shared across Vercel's
 *    serverless instances. The table is tiny and pruned opportunistically.
 *  - Two buckets: per source IP (a device hammering any PINs) and per PIN
 *    (a distributed attack focused on one code). A legit employee who
 *    mistypes a few times stays far under the limits.
 *  - Successful sign-in clears that (ip, pin) pair's failures — a waiter
 *    who fat-fingers twice then gets it right starts fresh next shift.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const IP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const IP_MAX_FAILS = 8; // per IP, across all PINs
const PIN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const PIN_MAX_FAILS = 15; // per PIN, across all IPs
const RETENTION_MS = 2 * 60 * 60 * 1000; // prune rows older than 2 hours

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; message: string };

/** Best-effort client IP (Vercel puts it in x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}

/** Count recent failures; `false` = blocked (429). */
export async function checkPinRateLimit(
  ip: string,
  pin: string
): Promise<RateLimitResult> {
  const now = Date.now();
  // opportunistic prune — keeps the table tiny even on a busy night
  await db.pinAttempt.deleteMany({
    where: { createdAt: { lt: new Date(now - RETENTION_MS) } },
  });

  const ipFails = await db.pinAttempt.count({
    where: { ip, createdAt: { gte: new Date(now - IP_WINDOW_MS) } },
  });
  if (ipFails >= IP_MAX_FAILS) {
    return {
      ok: false,
      retryAfterSec: Math.ceil(IP_WINDOW_MS / 1000),
      message: "Too many attempts — wait a few minutes and try again",
    };
  }

  const pinFails = await db.pinAttempt.count({
    where: { pin, createdAt: { gte: new Date(now - PIN_WINDOW_MS) } },
  });
  if (pinFails >= PIN_MAX_FAILS) {
    return {
      ok: false,
      retryAfterSec: Math.ceil(PIN_WINDOW_MS / 1000),
      message: "This PIN is temporarily locked — try again later",
    };
  }

  return { ok: true };
}

export async function recordPinFailure(ip: string, pin: string): Promise<void> {
  await db.pinAttempt.create({ data: { ip, pin } });
}

export async function clearPinFailures(ip: string, pin: string): Promise<void> {
  await db.pinAttempt.deleteMany({ where: { ip, pin } });
}

/* ─────────────────────────────────────────────────────────────────── */
/* r71 — generic limiter for the OPEN guest write endpoints            */
/*                                                                     */
/* Orders, amendments, ratings and coal/call requests are intentionally*/
/* cookie-free (guests have no accounts), which also makes them spam-  */
/* able. Each allowed call records one GuestAttempt row; a caller is   */
/* blocked (429) once `max` rows exist for their key inside the window.*/
/* DB-backed so the limit holds across serverless instances, pruned    */
/* opportunistically so the table stays tiny.                          */
/* ─────────────────────────────────────────────────────────────────── */

const GUEST_PRUNE_MS = 30 * 60 * 1000; // prune rows older than 30 min
let guestPrunedAt = 0;

export async function hitGuestRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  // opportunistic prune at most once a minute — keeps the table tiny
  if (now - guestPrunedAt > 60_000) {
    guestPrunedAt = now;
    await db.guestAttempt
      .deleteMany({ where: { createdAt: { lt: new Date(now - GUEST_PRUNE_MS) } } })
      .catch(() => {});
  }
  const hits = await db.guestAttempt.count({
    where: { key, createdAt: { gte: new Date(now - windowMs) } },
  });
  if (hits >= max) {
    return {
      ok: false,
      retryAfterSec: Math.ceil(windowMs / 1000),
      message: "Too many requests — wait a few minutes and try again",
    };
  }
  await db.guestAttempt.create({ data: { key } });
  return { ok: true };
}

/** Per-route guest limits (per IP, rolling window). */
export const GUEST_LIMITS = {
  order: { max: 25, windowMs: 10 * 60 * 1000 }, // group ordering for a table
  amend: { max: 30, windowMs: 10 * 60 * 1000 }, // cart revisions while editing
  rate: { max: 12, windowMs: 10 * 60 * 1000 }, // one rating per order anyway
  request: { max: 15, windowMs: 10 * 60 * 1000 }, // coal refills / call requests
  // r72 — the last cookie-free writes:
  favorite: { max: 20, windowMs: 10 * 60 * 1000 }, // saving a mix you liked
  favoriteDelete: { max: 40, windowMs: 10 * 60 * 1000 }, // pruning your list
  push: { max: 15, windowMs: 10 * 60 * 1000 }, // push subscribe/unsubscribe
  error: { max: 30, windowMs: 10 * 60 * 1000 }, // client error reports
  sommelier: { max: 20, windowMs: 60 * 1000 }, // LLM chat turns (per minute)
} as const;

/** Uniform 429 response for a blocked guest write. */
export function guestRateLimitResponse(limit: RateLimitResult & { ok: false }) {
  return NextResponse.json(
    { ok: false, error: limit.message },
    { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
  );
}

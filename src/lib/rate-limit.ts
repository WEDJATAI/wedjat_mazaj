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

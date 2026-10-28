import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  clientIp,
  GUEST_LIMITS,
  guestRateLimitResponse,
  hitGuestRateLimit,
} from "@/lib/rate-limit";

/**
 * r69 (audit ⑧) — lightweight error tracking.
 *
 * POST /api/errors   — the client reports an uncaught error / rejection
 *                      (throttled + size-capped; same-message reports
 *                      within 5 minutes increment a counter instead of
 *                      stacking duplicates).
 * GET  /api/errors   — the platform owner reviews the latest 100.
 *                      Gate: ?pin=<platform owner PIN> (same model as the
 *                      staff PIN surface — no anonymous stack exposure).
 */

const ReportSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  stack: z.string().trim().max(4000).optional().nullable(),
  url: z.string().trim().max(500).optional().nullable(),
  userAgent: z.string().trim().max(300).optional().nullable(),
});

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    // r72 — anonymous ingest → per-IP limit so the log can't be flooded
    // (the client reporter self-throttles; this is the server-side net)
    const limit = await hitGuestRateLimit(
      `errors:${clientIp(req.headers)}`,
      GUEST_LIMITS.error.max,
      GUEST_LIMITS.error.windowMs
    );
    if (!limit.ok) return guestRateLimitResponse(limit);
    const body = await req.json().catch(() => null);
    const parsed = ReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid error report" },
        { status: 400 }
      );
    }
    const { message, stack, url, userAgent } = parsed.data;

    // dedupe: same message inside the window → bump the counter
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recent = await db.errorLog.findFirst({
      where: { message, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      await db.errorLog.update({
        where: { id: recent.id },
        data: { count: { increment: 1 } },
      });
    } else {
      await db.errorLog.create({
        data: {
          message,
          stack: stack || null,
          source: "client",
          url: url || null,
          userAgent: userAgent || req.headers.get("user-agent") || null,
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("error-log ingest failed", err);
    // never break the client because the logger failed
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const pin = req.nextUrl.searchParams.get("pin");
    if (!pin) {
      return NextResponse.json(
        { ok: false, error: "pin required" },
        { status: 401 }
      );
    }
    const owner = await db.employee.findUnique({ where: { pin } });
    if (!owner || owner.role !== "platform_admin" || !owner.active) {
      return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }
    const errors = await db.errorLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ ok: true, errors });
  } catch (err) {
    console.error("error-log list failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not load errors" },
      { status: 500 }
    );
  }
}

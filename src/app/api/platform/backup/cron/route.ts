import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth";
import { runBackup } from "@/lib/backup";

/**
 * r73 — the nightly backup entry point.
 *
 * Vercel Cron hits this path once a day (vercel.json) and automatically
 * sends `Authorization: Bearer ${CRON_SECRET}` when that env var is set.
 * The platform owner can also fire it manually while signed in.
 *
 *   GET /api/platform/backup/cron
 *     ✓ Bearer CRON_SECRET (Vercel cron)
 *     ✓ platform_admin session (owner, manual)
 *     ✗ anything else → 401
 */

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const viaCron = Boolean(secret) && header === `Bearer ${secret}`;

  if (!viaCron) {
    // fall through to the owner session (manual trigger from the UI)
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;
  }

  try {
    const result = await runBackup("cron");
    return NextResponse.json({ ok: result.status !== "failed", result });
  } catch (err) {
    console.error("cron backup error", err);
    return NextResponse.json(
      { ok: false, error: "Backup failed" },
      { status: 500 }
    );
  }
}

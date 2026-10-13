import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth";
import { listBackupRuns, runBackup } from "@/lib/backup";

/**
 * r73 — off-site backups, owner surface (platform_admin only).
 *
 *   GET  /api/platform/backup — the newest 20 runs (the Settings tab
 *                              "Backups" card feed)
 *   POST /api/platform/backup — "Back up now": one manual run (same code
 *                              path as the nightly cron)
 */

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  {
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;
  }
  try {
    const runs = await listBackupRuns();
    return NextResponse.json({ ok: true, runs });
  } catch (err) {
    console.error("backup list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load backup history" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  {
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;
  }
  try {
    const result = await runBackup("manual");
    return NextResponse.json({ ok: result.status !== "failed", result });
  } catch (err) {
    console.error("manual backup error", err);
    return NextResponse.json(
      { ok: false, error: "Backup failed" },
      { status: 500 }
    );
  }
}

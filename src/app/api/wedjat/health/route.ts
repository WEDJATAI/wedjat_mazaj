import { NextRequest, NextResponse } from "next/server";
import { checkWedjatHealth } from "@/lib/wedjat";
import { requireStaff } from "@/lib/auth";

// GET /api/wedjat/health — connectivity check for the sync status dashboard.
// r71: staff session required (dashboard surface).
export async function GET(req: NextRequest) {
  try {
    {
      const guard = await requireStaff(req);
      if ("resp" in guard) return guard.resp;
    }
    const health = await checkWedjatHealth();
    return NextResponse.json({ ok: true, ...health });
  } catch (err) {
    console.error("wedjat health error", err);
    return NextResponse.json(
      { ok: false, connected: false, error: "Health check failed" },
      { status: 500 }
    );
  }
}

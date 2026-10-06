import { NextResponse } from "next/server";
import { checkWedjatHealth } from "@/lib/wedjat";

// GET /api/wedjat/health — connectivity check for the sync status dashboard.
export async function GET() {
  try {
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

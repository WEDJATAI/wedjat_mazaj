import { NextResponse } from "next/server";
import { listActiveBranches } from "@/lib/branch-scope";

/**
 * r57 — Active branches of active venues (public).
 * Powers the guest check-in branch picker and the staff branch chooser.
 */
export async function GET() {
  try {
    const branches = await listActiveBranches();
    return NextResponse.json({ ok: true, branches });
  } catch (err) {
    console.error("branches list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load branches" },
      { status: 500 }
    );
  }
}

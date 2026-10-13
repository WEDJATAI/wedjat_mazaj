import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdminSession } from "@/lib/auth";

/**
 * r71 — Platform Control Center · PEOPLE · session revocation.
 *
 * DELETE /api/platform/employees/[id]/sessions
 *   → signs the account out of EVERY device immediately (drops all their
 *     EmployeeSession rows). The platform owner uses this when a phone is
 *     lost, an employee leaves mid-shift, or an account is being wound
 *     down. Safe on the owner's own account too — it just signs the owner
 *     out everywhere (they can sign back in with their PIN).
 *
 * r70 session design recap: cookie → sha256 → EmployeeSession row, so
 * deleting the rows is the complete, instant revocation.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;

    const target = await db.employee.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!target) {
      return NextResponse.json(
        { ok: false, error: "Unknown account" },
        { status: 404 }
      );
    }

    const revoked = await db.employeeSession.deleteMany({
      where: { employeeId: id },
    });

    return NextResponse.json({
      ok: true,
      revoked: revoked.count,
      employee: { id: target.id, name: target.name },
    });
  } catch (err) {
    console.error("platform employee revoke sessions error", err);
    return NextResponse.json(
      { ok: false, error: "Could not revoke sessions" },
      { status: 500 }
    );
  }
}

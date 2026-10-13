import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toBranchInfo } from "@/lib/branch-scope";
import { clearSession, sessionEmployee } from "@/lib/auth";

/**
 * r70 — session lifecycle.
 *
 *  GET    /api/auth/session → who is signed in (from the httpOnly cookie),
 *         with the same employee payload the PIN login returns — the staff
 *         shell uses it to validate a persisted localStorage session and
 *         refresh branch context. 401 when the cookie is absent/expired.
 *  DELETE /api/auth/session → sign out: delete the session row + cookie.
 */
export async function GET(req: NextRequest) {
  const emp = await sessionEmployee(req);
  if (!emp) {
    return NextResponse.json(
      { ok: false, error: "No active session" },
      { status: 401 }
    );
  }
  // r57 multi-tenant context — same branch resolution as the login route
  let branches: ReturnType<typeof toBranchInfo>[] = [];
  if (emp.role === "platform_admin") {
    branches = [];
  } else if (emp.role === "venue_admin" || emp.role === "super_admin") {
    if (emp.venueId) {
      const rows = await db.branch.findMany({
        where: { venueId: emp.venueId, isActive: true },
        orderBy: [{ isFlagship: "desc" }, { createdAt: "asc" }],
        include: { venue: true },
      });
      branches = rows.map(toBranchInfo);
    }
  } else if (emp.branchId) {
    const row = await db.branch.findUnique({
      where: { id: emp.branchId },
      include: { venue: true },
    });
    branches = row ? [toBranchInfo(row)] : [];
  }
  return NextResponse.json({
    ok: true,
    employee: {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      permissions: emp.permissions,
      venueId: emp.venueId,
      branchId: emp.branchId,
      branches,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  await clearSession(res, req);
  return res;
}

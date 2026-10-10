import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { resolvePermissions, type Permission } from "@/lib/permissions";
import { toBranchInfo } from "@/lib/branch-scope";

const Schema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "PIN must be 4 digits"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid PIN" },
        { status: 400 }
      );
    }
    const { pin } = parsed.data;
    const emp = await db.employee.findUnique({ where: { pin } });
    if (!emp || !emp.active) {
      return NextResponse.json(
        { ok: false, error: "Invalid or inactive PIN" },
        { status: 401 }
      );
    }
    // r57: a suspended venue is disconnected from the platform — its staff
    // cannot operate (history stays, access stops)
    if (emp.venueId) {
      const venue = await db.venue.findUnique({
        where: { id: emp.venueId },
        select: { status: true, name: true },
      });
      if (venue?.status === "suspended") {
        return NextResponse.json(
          { ok: false, error: `${venue.name} is suspended — contact the platform admin` },
          { status: 403 }
        );
      }
    }
    const permissions = resolvePermissions(emp.role, emp.permissions);

    // r57 multi-tenant context — which branches can this employee operate?
    let branches: ReturnType<typeof toBranchInfo>[] = [];
    if (emp.role === "platform_admin") {
      // the platform owner does not work a branch — they get the console
      branches = [];
    } else if (emp.role === "venue_admin" || emp.role === "super_admin") {
      // multi-branch floaters: every active branch of their venue
      if (emp.venueId) {
        const rows = await db.branch.findMany({
          where: { venueId: emp.venueId, isActive: true },
          orderBy: [{ isFlagship: "desc" }, { createdAt: "asc" }],
          include: { venue: true },
        });
        branches = rows.map(toBranchInfo);
      }
    } else if (emp.branchId) {
      // branch-pinned staff: exactly their branch (even if the whole venue
      // has more — the chooser only appears for floaters)
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
        permissions,
        venueId: emp.venueId ?? null,
        // null branchId = the employee floats across branches (venue admin)
        branchId: emp.branchId ?? null,
        branches,
      },
    });
  } catch (err) {
    console.error("employee auth error", err);
    return NextResponse.json(
      { ok: false, error: "Could not sign in" },
      { status: 500 }
    );
  }
}

// Keep the Permission type referenced for downstream typing
export type { Permission };

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  ROLES,
  ALL_PERMISSIONS,
  parsePermissions,
  resolvePermissions,
  type Role,
} from "@/lib/permissions";

/**
 * r57 — staff management now carries multi-tenant scope:
 * every employee has a role (platform_admin | venue_admin | super_admin |
 * admin | employee) and may be pinned to one branch (branchId) or float
 * across their venue's branches (branchId = null).
 */
export async function GET() {
  try {
    const employees = await db.employee.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { branch: { select: { id: true, name: true, nameAr: true } } },
    });
    const withPerms = employees.map((e) => ({
      id: e.id,
      name: e.name,
      pin: e.pin,
      role: e.role,
      active: e.active,
      venueId: e.venueId,
      branchId: e.branchId,
      branchName: e.branch ? e.branch.nameAr ?? e.branch.name : null,
      createdAt: e.createdAt,
      permissions: resolvePermissions(e.role, e.permissions),
    }));
    return NextResponse.json({
      ok: true,
      employees: withPerms,
      roles: ROLES,
      allPermissions: ALL_PERMISSIONS,
    });
  } catch (err) {
    console.error("list employees error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load employees" },
      { status: 500 }
    );
  }
}

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  pin: z.string().trim().regex(/^\d{4}$/, "PIN must be 4 digits"),
  role: z
    .enum(["platform_admin", "venue_admin", "super_admin", "admin", "employee"])
    .default("employee"),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).default([]),
  // r57 scope: pin to a branch (or null = floats across the venue)
  branchId: z.string().trim().optional().nullable(),
  venueId: z.string().trim().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { name, pin, role, permissions, branchId, venueId } = parsed.data;
    const dup = await db.employee.findUnique({ where: { pin } });
    if (dup) {
      return NextResponse.json(
        { ok: false, error: "PIN already in use" },
        { status: 409 }
      );
    }
    // resolve the venue from the branch when only a branch is given
    let resolvedVenueId = venueId ?? null;
    if (!resolvedVenueId && branchId) {
      const branch = await db.branch.findUnique({
        where: { id: branchId },
        select: { venueId: true },
      });
      resolvedVenueId = branch?.venueId ?? null;
    }
    // Custom permissions only stored if they differ from the role default;
    // otherwise empty (fall back to role default).
    const roleDefault = resolvePermissions(role, null).sort().join(",");
    const custom = permissions.sort().join(",");
    const permsStr = custom === roleDefault ? "" : permissions.join(",");
    const created = await db.employee.create({
      data: {
        name,
        pin,
        role: role as Role,
        permissions: permsStr,
        active: true,
        branchId: branchId || null,
        venueId: resolvedVenueId,
      },
    });
    return NextResponse.json({
      ok: true,
      employee: {
        ...created,
        permissions: resolvePermissions(created.role, created.permissions),
      },
    });
  } catch (err) {
    console.error("create employee error", err);
    return NextResponse.json(
      { ok: false, error: "Could not create employee" },
      { status: 500 }
    );
  }
}

// silence unused import in some toolchains
void parsePermissions;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  ALL_PERMISSIONS,
  resolvePermissions,
  type Role,
} from "@/lib/permissions";

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(["super_admin", "admin", "employee"]).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
  active: z.boolean().optional(),
  pin: z.string().trim().regex(/^\d{4}$/).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Employee not found" },
        { status: 404 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.pin !== undefined) {
      // ensure pin uniqueness if changing
      const clash = await db.employee.findUnique({ where: { pin: data.pin } });
      if (clash && clash.id !== id) {
        return NextResponse.json(
          { ok: false, error: "PIN already in use" },
          { status: 409 }
        );
      }
      updateData.pin = data.pin;
    }
    if (data.role !== undefined) {
      updateData.role = data.role as Role;
      // when role changes, clear custom permissions unless they were also sent
      if (data.permissions === undefined) updateData.permissions = "";
    }
    if (data.permissions !== undefined) {
      const role = (data.role ?? existing.role) as Role;
      const roleDefault = resolvePermissions(role, null).sort().join(",");
      const custom = data.permissions.sort().join(",");
      updateData.permissions = custom === roleDefault ? "" : data.permissions.join(",");
    }

    const updated = await db.employee.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({
      ok: true,
      employee: { ...updated, permissions: resolvePermissions(updated.role, updated.permissions) },
    });
  } catch (err) {
    console.error("update employee error", err);
    return NextResponse.json(
      { ok: false, error: "Could not update employee" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Employee not found" },
        { status: 404 }
      );
    }
    // Guard: never delete the last super_admin.
    if (existing.role === "super_admin") {
      const superCount = await db.employee.count({ where: { role: "super_admin", active: true } });
      if (superCount <= 1) {
        return NextResponse.json(
          { ok: false, error: "Cannot delete the last super admin" },
          { status: 409 }
        );
      }
    }
    await db.employee.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete employee error", err);
    return NextResponse.json(
      { ok: false, error: "Could not delete employee" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platform-auth";

/**
 * r61 — Platform Control Center · PEOPLE · PATCH one account.
 *
 * PATCH /api/platform/employees/[id]
 *   { employeeId, active?: boolean, name?: string }
 *
 * Safety rails:
 *   • the platform owner can never disable or rename THEMSELVES from here
 *     (a lone lockout would take the whole control center down)
 *   • role changes are intentionally NOT offered — role is part of the
 *     onboarding contract between the platform and its venues
 */

const PatchSchema = z.object({
  employeeId: z.string(),
  active: z.boolean().optional(),
  name: z.string().trim().min(2).max(60).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const admin = await requirePlatformAdmin(data.employeeId);
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Platform admin only" },
        { status: 403 }
      );
    }
    if (id === admin.id && (data.active === false || data.name)) {
      return NextResponse.json(
        { ok: false, error: "You cannot edit or disable your own platform account" },
        { status: 400 }
      );
    }

    const target = await db.employee.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ ok: false, error: "Unknown account" }, { status: 404 });
    }

    const updated = await db.employee.update({
      where: { id },
      data: {
        ...(typeof data.active === "boolean" ? { active: data.active } : {}),
        ...(data.name ? { name: data.name } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      employee: { id: updated.id, name: updated.name, active: updated.active },
    });
  } catch (err) {
    console.error("platform employee patch error", err);
    return NextResponse.json(
      { ok: false, error: "Could not update the account" },
      { status: 500 }
    );
  }
}

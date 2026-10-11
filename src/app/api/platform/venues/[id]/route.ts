import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * r57 — Platform super-admin venue controls.
 * PATCH /api/platform/venues/[id] { employeeId, status }
 *   status: "active"   → connect / re-activate a venue
 *          "pending"   → park it (awaiting paperwork / payment)
 *          "suspended" → hard-off: its branches disappear from guest
 *                        check-in and staff floats, its orders keep their
 *                        history (nothing is deleted — a platform never
 *                        destroys its restaurants' records)
 */

const PatchSchema = z.object({
  employeeId: z.string(),
  status: z.enum(["active", "pending", "suspended"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { employeeId, status } = parsed.data;
    const admin = await db.employee.findUnique({ where: { id: employeeId } });
    if (!admin || !admin.active || admin.role !== "platform_admin") {
      return NextResponse.json(
        { ok: false, error: "Platform admin only" },
        { status: 403 }
      );
    }
    const venue = await db.venue.findUnique({ where: { id } });
    if (!venue) {
      return NextResponse.json({ ok: false, error: "Venue not found" }, { status: 404 });
    }
    const updated = await db.venue.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({
      ok: true,
      venue: { id: updated.id, name: updated.name, status: updated.status },
    });
  } catch (err) {
    console.error("platform venue patch error", err);
    return NextResponse.json(
      { ok: false, error: "Could not update venue" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/orders/[id]/assign
// An employee confirms/claims an unassigned guest order → it goes under their name.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { employeeId, employeeName } = body as {
      employeeId?: string;
      employeeName?: string;
    };
    if (!employeeId || !employeeName) {
      return NextResponse.json(
        { ok: false, error: "employeeId and employeeName required" },
        { status: 400 }
      );
    }
    const existing = await db.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 }
      );
    }
    // Only unassigned orders (or already-assigned-to-someone) can be claimed.
    // If it's already assigned to a different employee, reject.
    if (existing.assignedToId && existing.assignedToId !== employeeId) {
      return NextResponse.json(
        { ok: false, error: "Already claimed by another employee" },
        { status: 409 }
      );
    }
    const updated = await db.order.update({
      where: { id },
      data: {
        assignment: "assigned",
        assignedToId: employeeId,
        assignedToName: employeeName,
        employeeId,
        orderedByName: employeeName,
        status: existing.status === "pending" ? "preparing" : existing.status,
      },
    });
    return NextResponse.json({ ok: true, order: updated });
  } catch (err) {
    console.error("assign order error", err);
    return NextResponse.json(
      { ok: false, error: "Could not assign order" },
      { status: 500 }
    );
  }
}

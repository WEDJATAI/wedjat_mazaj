import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = typeof body.status === "string" ? body.status : "acknowledged";

    const existing = await db.serviceRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Request not found" },
        { status: 404 }
      );
    }

    const updated = await db.serviceRequest.update({
      where: { id },
      data: {
        status,
        acknowledgedAt:
          status === "acknowledged" ? new Date() : existing.acknowledgedAt,
      },
    });
    return NextResponse.json({ ok: true, request: updated });
  } catch (err) {
    console.error("update request error", err);
    return NextResponse.json(
      { ok: false, error: "Could not update request" },
      { status: 500 }
    );
  }
}

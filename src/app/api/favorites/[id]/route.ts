import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.favoriteMix.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Favorite not found" },
        { status: 404 }
      );
    }
    await db.favoriteMix.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete favorite error", err);
    return NextResponse.json(
      { ok: false, error: "Could not delete favorite" },
      { status: 500 }
    );
  }
}

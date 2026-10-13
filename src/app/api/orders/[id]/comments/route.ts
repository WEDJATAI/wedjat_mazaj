import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";

/**
 * r70 — order comments are a staff-only conversation about a live order:
 * both listing and posting require a staff session, and the comment
 * author is the signed-in employee (never a client-supplied name).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    {
      const guard = await requireStaff(req);
      if ("resp" in guard) return guard.resp;
    }
    const { id } = await params;
    const comments = await db.orderComment.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ ok: true, comments });
  } catch (err) {
    console.error("list comments error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load comments" },
      { status: 500 }
    );
  }
}

const CreateCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireStaff(req);
    if ("resp" in guard) return guard.resp;
    const { name: author } = guard.emp;
    const { id } = await params;
    const body = await req.json();
    const parsed = CreateCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid comment",
        },
        { status: 400 }
      );
    }
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 }
      );
    }
    const created = await db.orderComment.create({
      data: {
        orderId: id,
        author,
        body: parsed.data.body,
      },
    });
    return NextResponse.json({ ok: true, comment: created });
  } catch (err) {
    console.error("create comment error", err);
    return NextResponse.json(
      { ok: false, error: "Could not add comment" },
      { status: 500 }
    );
  }
}

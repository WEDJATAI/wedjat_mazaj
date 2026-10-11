import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
  author: z.string().trim().min(1, "Author is required").max(80),
  body: z.string().trim().min(1, "Comment cannot be empty").max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
        author: parsed.data.author,
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

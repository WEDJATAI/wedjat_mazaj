import { NextRequest, NextResponse } from "next/server";
import { pushOrderToWedjat } from "@/lib/wedjat";
import { z } from "zod";

const Schema = z.object({
  tableName: z.string().min(1, "Table name is required"),
  items: z
    .array(
      z.object({
        name: z.string(),
        price: z.number().nonnegative(),
        qty: z.number().int().positive(),
      })
    )
    .min(1, "At least one item required"),
  total: z.number().nonnegative(),
  customerName: z.string().optional().nullable(),
  source: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" },
        { status: 400 }
      );
    }
    const result = await pushOrderToWedjat(parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, wedjatOrderId: result.wedjatOrderId });
  } catch (err) {
    console.error("wedjat push-order error", err);
    return NextResponse.json(
      { ok: false, error: "Could not push order to Wedjat" },
      { status: 500 }
    );
  }
}

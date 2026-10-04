import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const requests = await db.serviceRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ ok: true, requests });
  } catch (err) {
    console.error("requests list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load requests" },
      { status: 500 }
    );
  }
}

import { z } from "zod";

const CreateSchema = z.object({
  type: z.string().default("call_shisha_man"),
  guestName: z.string().trim().max(80).optional().or(z.literal("")),
  table: z.string().trim().max(40).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const created = await db.serviceRequest.create({
      data: {
        type: data.type,
        guestName: data.guestName || null,
        table: data.table || null,
        note: data.note || null,
        status: "pending",
      },
    });
    return NextResponse.json({ ok: true, request: created });
  } catch (err) {
    console.error("create request error", err);
    return NextResponse.json(
      { ok: false, error: "Could not create request" },
      { status: 500 }
    );
  }
}

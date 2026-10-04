import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const Schema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "PIN must be 4 digits"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid PIN" },
        { status: 400 }
      );
    }
    const { pin } = parsed.data;
    const emp = await db.employee.findUnique({ where: { pin } });
    if (!emp || !emp.active) {
      return NextResponse.json(
        { ok: false, error: "Invalid or inactive PIN" },
        { status: 401 }
      );
    }
    return NextResponse.json({
      ok: true,
      employee: {
        id: emp.id,
        name: emp.name,
        role: emp.role,
      },
    });
  } catch (err) {
    console.error("employee auth error", err);
    return NextResponse.json(
      { ok: false, error: "Could not sign in" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  SIGNUP_BONUS,
  tierForLifetime,
} from "@/lib/loyalty";

/**
 * GET /api/loyalty            → list all members + program stats (manager)
 * GET /api/loyalty?phone=...  → single member lookup (checkout)
 */
export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone");

    if (phone) {
      const normalized = phone.trim();
      if (!normalized) {
        return NextResponse.json(
          { ok: false, error: "phone required" },
          { status: 400 }
        );
      }
      const member = await db.loyaltyMember.findUnique({
        where: { phone: normalized },
        include: {
          ledger: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      });
      return NextResponse.json({ ok: true, member });
    }

    // Full list + program stats for the manager panel.
    const members = await db.loyaltyMember.findMany({
      orderBy: { lifetimePoints: "desc" },
      take: 200,
      include: { ledger: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    const redeemAgg = await db.pointsLedger.aggregate({
      where: { reason: "redeem" },
      _sum: { delta: true },
    });
    const earnAgg = await db.pointsLedger.aggregate({
      where: { reason: "order_earn" },
      _sum: { delta: true },
    });

    const stats = {
      members: members.length,
      pointsOutstanding: members.reduce((s, m) => s + m.points, 0),
      lifetimePoints: members.reduce((s, m) => s + m.lifetimePoints, 0),
      pointsRedeemed: Math.abs(redeemAgg._sum.delta ?? 0),
      pointsEarned: earnAgg._sum.delta ?? 0,
    };

    return NextResponse.json({ ok: true, members, stats });
  } catch (err) {
    console.error("loyalty GET error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load loyalty data" },
      { status: 500 }
    );
  }
}

const EnrollSchema = z.object({
  phone: z.string().trim().min(5).max(20),
  name: z.string().trim().min(1).max(80),
});

/**
 * POST /api/loyalty — enroll a new member (idempotent per phone:
 * if the phone already exists the existing member is returned).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" },
        { status: 400 }
      );
    }
    const { phone, name } = parsed.data;

    const existing = await db.loyaltyMember.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ ok: true, member: existing, existed: true });
    }

    const member = await db.$transaction(async (tx) => {
      const created = await tx.loyaltyMember.create({
        data: {
          phone,
          name,
          points: SIGNUP_BONUS,
          lifetimePoints: SIGNUP_BONUS,
          tier: tierForLifetime(SIGNUP_BONUS).key,
        },
      });
      await tx.pointsLedger.create({
        data: {
          memberId: created.id,
          delta: SIGNUP_BONUS,
          reason: "signup_bonus",
        },
      });
      return created;
    });

    return NextResponse.json({ ok: true, member, existed: false });
  } catch (err) {
    console.error("loyalty enroll error", err);
    return NextResponse.json(
      { ok: false, error: "Could not enroll member" },
      { status: 500 }
    );
  }
}

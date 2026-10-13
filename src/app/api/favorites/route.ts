import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { sessionEmployee } from "@/lib/auth";
import {
  clientIp,
  GUEST_LIMITS,
  guestRateLimitResponse,
  hitGuestRateLimit,
} from "@/lib/rate-limit";

// Favorites are keyed by guest name (lightweight — no auth/accounts here).

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const guestName = searchParams.get("guestName");
    // r72 — the list is scoped to ONE guest: without this check the
    // endpoint used to hand out every other guest's saved mixes.
    if (!guestName) {
      return NextResponse.json(
        { ok: false, error: "guestName is required" },
        { status: 400 }
      );
    }
    const favorites = await db.favoriteMix.findMany({
      where: { guestName },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ ok: true, favorites });
  } catch (err) {
    console.error("favorites list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load favorites" },
      { status: 500 }
    );
  }
}

const ComponentSchema = z.object({
  brandId: z.string(),
  brandName: z.string(),
  flavorName: z.string(),
  emoji: z.string().default(""),
  grams: z.number().positive(),
});

const CreateFavoriteSchema = z.object({
  guestName: z.string().trim().min(1, "Guest name is required").max(80),
  label: z.string().trim().min(1, "Give your mix a name").max(60),
  components: z.array(ComponentSchema).min(1, "Add at least one flavor"),
});

export async function POST(req: NextRequest) {
  try {
    // r72 — cookie-free guest write → per-IP limit (staff sessions
    // bypass, same model as the r71 guest-write endpoints)
    const caller = await sessionEmployee(req);
    if (!caller) {
      const limit = await hitGuestRateLimit(
        `fav:${clientIp(req.headers)}`,
        GUEST_LIMITS.favorite.max,
        GUEST_LIMITS.favorite.windowMs
      );
      if (!limit.ok) return guestRateLimitResponse(limit);
    }
    const body = await req.json();
    const parsed = CreateFavoriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid favorite",
        },
        { status: 400 }
      );
    }
    const { guestName, label, components } = parsed.data;
    // avoid duplicate labels for the same guest
    const dup = await db.favoriteMix.findFirst({
      where: { guestName, label },
    });
    if (dup) {
      return NextResponse.json(
        { ok: false, error: "You already have a mix with that name" },
        { status: 409 }
      );
    }
    const created = await db.favoriteMix.create({
      data: {
        guestName,
        label,
        componentsJson: JSON.stringify(components),
      },
    });
    return NextResponse.json({ ok: true, favorite: created });
  } catch (err) {
    console.error("create favorite error", err);
    return NextResponse.json(
      { ok: false, error: "Could not save favorite" },
      { status: 500 }
    );
  }
}

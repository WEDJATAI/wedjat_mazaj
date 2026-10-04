import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

// Favorites are keyed by guest name (lightweight — no auth/accounts here).

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const guestName = searchParams.get("guestName");
    const where = guestName ? { guestName } : undefined;
    const favorites = await db.favoriteMix.findMany({
      where,
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

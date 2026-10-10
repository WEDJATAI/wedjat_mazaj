import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * r57 — Add a branch to an existing venue (platform admin or the venue's
 * own admin). The new branch starts active but unstocked — its inventory
 * gets created on first restock / first order (upsert semantics in the
 * orders + inventory routes handle missing rows gracefully).
 */

const CreateSchema = z.object({
  employeeId: z.string(),
  venueId: z.string(),
  name: z.string().trim().min(2).max(60),
  nameAr: z.string().trim().max(60).optional().or(z.literal("")),
});

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "branch"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const emp = await db.employee.findUnique({ where: { id: data.employeeId } });
    const isPlatformAdmin = emp?.role === "platform_admin";
    const isVenueAdmin =
      (emp?.role === "venue_admin" || emp?.role === "super_admin") &&
      emp?.venueId === data.venueId;
    if (!emp || !emp.active || (!isPlatformAdmin && !isVenueAdmin)) {
      return NextResponse.json(
        { ok: false, error: "Not allowed to manage this venue's branches" },
        { status: 403 }
      );
    }

    const venue = await db.venue.findUnique({ where: { id: data.venueId } });
    if (!venue) {
      return NextResponse.json({ ok: false, error: "Venue not found" }, { status: 404 });
    }

    let slug = slugify(data.name);
    let n = 1;
    while (await db.branch.findUnique({ where: { slug } })) {
      slug = `${slugify(data.name)}-${n++}`;
    }
    const branch = await db.branch.create({
      data: {
        venueId: venue.id,
        name: data.name,
        nameAr: data.nameAr || null,
        slug,
        isFlagship: false,
        isActive: true,
      },
    });
    return NextResponse.json({
      ok: true,
      branch: { id: branch.id, name: branch.name, slug: branch.slug },
    });
  } catch (err) {
    console.error("platform branch create error", err);
    return NextResponse.json(
      { ok: false, error: "Could not add branch" },
      { status: 500 }
    );
  }
}

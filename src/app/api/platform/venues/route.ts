import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * r57 — Platform super-admin venue management.
 *
 * GET  /api/platform/venues  — every venue with branch count + today's
 *                              orders/revenue (the command-center grid)
 * POST /api/platform/venues  — onboard a café/restaurant: creates the
 *                              venue, its first (flagship) branch, and the
 *                              venue's own admin account in one shot.
 *
 * Authz: the caller must present a platform_admin employeeId; staff PINs
 * can't touch the platform layer.
 */

async function requirePlatformAdmin(employeeId: string | null) {
  if (!employeeId) return null;
  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  if (!emp || !emp.active || emp.role !== "platform_admin") return null;
  return emp;
}

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employeeId");
    const admin = await requirePlatformAdmin(employeeId);
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Platform admin only" },
        { status: 403 }
      );
    }

    const venues = await db.venue.findMany({
      orderBy: { createdAt: "asc" },
      include: { branches: { orderBy: [{ isFlagship: "desc" }, { createdAt: "asc" }] } },
    });

    // today's stats per venue (orders + revenue across all its branches)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const orders = await db.order.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { total: true, branchId: true, status: true },
    });
    const branchVenue = new Map<string, string>();
    for (const v of venues) for (const b of v.branches) branchVenue.set(b.id, v.id);

    const stats = new Map<string, { ordersToday: number; revenueToday: number }>();
    for (const v of venues) stats.set(v.id, { ordersToday: 0, revenueToday: 0 });
    for (const o of orders) {
      if (!o.branchId) continue;
      const vid = branchVenue.get(o.branchId);
      if (!vid) continue;
      const s = stats.get(vid);
      if (!s) continue;
      s.ordersToday += 1;
      s.revenueToday += o.total;
    }

    return NextResponse.json({
      ok: true,
      venues: venues.map((v) => ({
        id: v.id,
        name: v.name,
        nameAr: v.nameAr,
        slug: v.slug,
        kind: v.kind,
        status: v.status,
        createdAt: v.createdAt.toISOString(),
        branches: v.branches.map((b) => ({
          id: b.id,
          name: b.name,
          nameAr: b.nameAr,
          slug: b.slug,
          isFlagship: b.isFlagship,
          isActive: b.isActive,
        })),
        ordersToday: stats.get(v.id)?.ordersToday ?? 0,
        revenueToday: stats.get(v.id)?.revenueToday ?? 0,
      })),
    });
  } catch (err) {
    console.error("platform venues list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load venues" },
      { status: 500 }
    );
  }
}

const CreateSchema = z.object({
  employeeId: z.string(), // the platform admin performing the onboarding
  name: z.string().trim().min(2).max(60),
  nameAr: z.string().trim().max(60).optional().or(z.literal("")),
  kind: z.enum(["hookah", "cafe", "restaurant"]),
  // first (flagship) branch
  branchName: z.string().trim().min(2).max(60),
  branchNameAr: z.string().trim().max(60).optional().or(z.literal("")),
  // the venue's own admin account
  adminName: z.string().trim().min(2).max(60),
  adminPin: z.string().trim().regex(/^\d{4}$/, "Admin PIN must be 4 digits"),
});

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "venue"
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
    const admin = await requirePlatformAdmin(data.employeeId);
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Platform admin only" },
        { status: 403 }
      );
    }

    // unique PIN guard
    const pinTaken = await db.employee.findUnique({ where: { pin: data.adminPin } });
    if (pinTaken) {
      return NextResponse.json(
        { ok: false, error: "That admin PIN is already used by another employee" },
        { status: 409 }
      );
    }

    const venue = await db.$transaction(async (tx) => {
      // unique-enough slug (append counter on collision)
      let slug = slugify(data.name);
      let n = 1;
      while (await tx.venue.findUnique({ where: { slug } })) {
        slug = `${slugify(data.name)}-${n++}`;
      }
      const createdVenue = await tx.venue.create({
        data: {
          name: data.name,
          nameAr: data.nameAr || null,
          slug,
          kind: data.kind,
          status: "active", // connected from the moment it's onboarded
        },
      });

      let branchSlug = slugify(data.branchName);
      let m = 1;
      while (await tx.branch.findUnique({ where: { slug: branchSlug } })) {
        branchSlug = `${slugify(data.branchName)}-${m++}`;
      }
      const branch = await tx.branch.create({
        data: {
          venueId: createdVenue.id,
          name: data.branchName,
          nameAr: data.branchNameAr || null,
          slug: branchSlug,
          isFlagship: true,
          isActive: true,
        },
      });

      // the venue's own admin — full operational permissions at their venue
      const venueAdmin = await tx.employee.create({
        data: {
          name: data.adminName,
          pin: data.adminPin,
          role: "venue_admin",
          permissions: "",
          active: true,
          venueId: createdVenue.id,
          branchId: null, // floats across every branch of their venue
        },
      });

      return { venue: createdVenue, branch, venueAdmin };
    });

    return NextResponse.json({
      ok: true,
      venue: {
        id: venue.venue.id,
        name: venue.venue.name,
        slug: venue.venue.slug,
        kind: venue.venue.kind,
        status: venue.venue.status,
      },
      branch: { id: venue.branch.id, name: venue.branch.name },
      admin: { id: venue.venueAdmin.id, name: venue.venueAdmin.name },
    });
  } catch (err) {
    console.error("platform venue create error", err);
    return NextResponse.json(
      { ok: false, error: "Could not onboard venue" },
      { status: 500 }
    );
  }
}

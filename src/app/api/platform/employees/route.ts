import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requirePlatformAdminSession } from "@/lib/auth";

/**
 * r61 — Platform Control Center · PEOPLE.
 *
 * GET  /api/platform/employees   — every account across the platform with
 *        its venue/branch scope (the directory the platform owner oversees;
 *        venue internals stay with the venue admins).
 * POST /api/platform/employees   — create a platform-level or venue-scoped
 *        account (owner names the role + venue/branch).
 *
 * r70: caller = platform_admin session cookie.
 */

const ROLES = ["platform_admin", "venue_admin", "super_admin", "admin", "employee"];

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;

    const employees = await db.employee.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      include: {
        branch: { select: { id: true, name: true, nameAr: true } },
      },
    });
    const venues = await db.venue.findMany({
      select: { id: true, name: true, nameAr: true },
      orderBy: { createdAt: "asc" },
    });
    const venueById = new Map(venues.map((v) => [v.id, v]));

    return NextResponse.json({
      ok: true,
      employees: employees.map((e) => {
        const venue = e.venueId ? venueById.get(e.venueId) : undefined;
        return {
          id: e.id,
          name: e.name,
          role: e.role,
          active: e.active,
          venue: venue ? { id: venue.id, name: venue.name, nameAr: venue.nameAr } : null,
          branch: e.branch
            ? { id: e.branch.id, name: e.branch.name, nameAr: e.branch.nameAr }
            : null,
          createdAt: e.createdAt.toISOString(),
        };
      }),
    });
  } catch (err) {
    console.error("platform employees list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load people" },
      { status: 500 }
    );
  }
}

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  pin: z.string().trim().regex(/^\d{4}$/, "PIN must be 4 digits"),
  role: z.enum(["platform_admin", "venue_admin", "super_admin", "admin", "employee"]),
  venueId: z.string().optional().or(z.literal("")),
  branchId: z.string().optional().or(z.literal("")),
});

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
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;

    const pinTaken = await db.employee.findUnique({ where: { pin: data.pin } });
    if (pinTaken) {
      return NextResponse.json(
        { ok: false, error: "That PIN is already used by another account" },
        { status: 409 }
      );
    }

    // scope validation
    if (data.role === "platform_admin" && (data.venueId || data.branchId)) {
      return NextResponse.json(
        { ok: false, error: "Platform owners float above venues — leave venue & branch empty" },
        { status: 400 }
      );
    }
    if (data.venueId) {
      const venue = await db.venue.findUnique({ where: { id: data.venueId } });
      if (!venue) {
        return NextResponse.json({ ok: false, error: "Unknown venue" }, { status: 400 });
      }
    }
    if (data.branchId) {
      const branch = await db.branch.findUnique({
        where: { id: data.branchId },
        include: { venue: { select: { id: true } } },
      });
      if (!branch) {
        return NextResponse.json({ ok: false, error: "Unknown branch" }, { status: 400 });
      }
      if (data.venueId && branch.venue.id !== data.venueId) {
        return NextResponse.json(
          { ok: false, error: "That branch belongs to a different venue" },
          { status: 400 }
        );
      }
    }

    const created = await db.employee.create({
      data: {
        name: data.name,
        pin: data.pin,
        role: data.role,
        permissions: "", // role defaults
        active: true,
        venueId: data.venueId || null,
        branchId: data.branchId || null,
      },
    });

    return NextResponse.json({
      ok: true,
      employee: { id: created.id, name: created.name, role: created.role },
    });
  } catch (err) {
    console.error("platform employee create error", err);
    return NextResponse.json(
      { ok: false, error: "Could not create the account" },
      { status: 500 }
    );
  }
}

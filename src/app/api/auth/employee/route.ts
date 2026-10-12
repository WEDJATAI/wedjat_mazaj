import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { resolvePermissions, type Permission } from "@/lib/permissions";
import { toBranchInfo } from "@/lib/branch-scope";

const Schema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "PIN must be 4 digits"),
});

/* ── r68-audit: PIN brute-force guard ─────────────────────────────────
 * 5 failed attempts per IP → 15-minute lockout (in-memory; the app is a
 * single deployment so this holds in production). Successful sign-ins
 * reset the counter. 4-digit PINs only have 10,000 combinations — without
 * this, a script walks the whole space in seconds. */
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failMap = new Map<string, { fails: number; lockedUntil: number }>();

// periodic sweep so the map never grows unbounded
if (typeof globalThis !== "undefined") {
  const g = globalThis as { __pinSweep?: ReturnType<typeof setInterval> };
  if (!g.__pinSweep) {
    g.__pinSweep = setInterval(() => {
      const now = Date.now();
      for (const [ip, e] of failMap) {
        if (e.lockedUntil < now && e.fails === 0) failMap.delete(ip);
      }
    }, 120_000);
  }
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local"
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const entry = failMap.get(ip);
    if (entry && entry.lockedUntil > Date.now()) {
      const waitMin = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        {
          ok: false,
          error: `Too many wrong PINs — try again in ${waitMin} minute${
            waitMin === 1 ? "" : "s"
          }`,
        },
        { status: 429, headers: { "Retry-After": String(waitMin * 60) } }
      );
    }

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
      const fails = (entry?.fails ?? 0) + 1;
      const lockedUntil = fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0;
      failMap.set(ip, { fails, lockedUntil });
      return NextResponse.json(
        {
          ok: false,
          error:
            lockedUntil > 0
              ? `Too many wrong PINs — locked for 15 minutes`
              : `Invalid or inactive PIN (${MAX_FAILS - fails} ${
                  MAX_FAILS - fails === 1 ? "try" : "tries"
                } left)`,
        },
        { status: lockedUntil > 0 ? 429 : 401 }
      );
    }
    // r57: a suspended venue is disconnected from the platform — its staff
    // cannot operate (history stays, access stops)
    if (emp.venueId) {
      const venue = await db.venue.findUnique({
        where: { id: emp.venueId },
        select: { status: true, name: true },
      });
      if (venue?.status === "suspended") {
        return NextResponse.json(
          { ok: false, error: `${venue.name} is suspended — contact the platform admin` },
          { status: 403 }
        );
      }
    }
    const permissions = resolvePermissions(emp.role, emp.permissions);

    // r57 multi-tenant context — which branches can this employee operate?
    let branches: ReturnType<typeof toBranchInfo>[] = [];
    if (emp.role === "platform_admin") {
      // the platform owner does not work a branch — they get the console
      branches = [];
    } else if (emp.role === "venue_admin" || emp.role === "super_admin") {
      // multi-branch floaters: every active branch of their venue
      if (emp.venueId) {
        const rows = await db.branch.findMany({
          where: { venueId: emp.venueId, isActive: true },
          orderBy: [{ isFlagship: "desc" }, { createdAt: "asc" }],
          include: { venue: true },
        });
        branches = rows.map(toBranchInfo);
      }
    } else if (emp.branchId) {
      // branch-pinned staff: exactly their branch (even if the whole venue
      // has more — the chooser only appears for floaters)
      const row = await db.branch.findUnique({
        where: { id: emp.branchId },
        include: { venue: true },
      });
      branches = row ? [toBranchInfo(row)] : [];
    }

    // success → clear this IP's failure streak (r68-audit rate limit)
    if (failMap.has(ip)) failMap.delete(ip);

    return NextResponse.json({
      ok: true,
      employee: {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        permissions,
        venueId: emp.venueId ?? null,
        // null branchId = the employee floats across branches (venue admin)
        branchId: emp.branchId ?? null,
        branches,
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

// Keep the Permission type referenced for downstream typing
export type { Permission };

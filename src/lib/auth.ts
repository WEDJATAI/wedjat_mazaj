import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolvePermissions, type Permission } from "@/lib/permissions";
import { clientIp } from "@/lib/rate-limit";

/**
 * r70 — SERVER-SIDE STAFF SESSIONS.
 *
 * Before r70 every privileged API route trusted a client-supplied
 * `employeeId` (query param or body field): anyone who learned or guessed a
 * cuid could impersonate staff. Now the PIN login mints a session token —
 * 32 random bytes delivered in an httpOnly cookie — and privileged routes
 * derive the caller from THAT, never from the request payload.
 *
 * Design:
 *  - the cookie holds the raw token; the DB row id is sha256(token), so a
 *    DB leak never yields usable cookies
 *  - 30-day sliding expiry, refreshed on every authenticated request
 *  - lookup also re-checks `employee.active` and venue suspension so a
 *    deactivated employee is signed out at their next API call
 */

export const SESSION_COOKIE = "mazaj_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, sliding

export interface SessionEmployee {
  id: string;
  name: string;
  role: string;
  permissions: Permission[];
  venueId: string | null;
  branchId: string | null;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Constant-time compare of the incoming token hash against the stored id. */
function sameHash(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/**
 * Mint a session for a freshly-authenticated employee and attach the
 * httpOnly cookie to the outgoing response. Returns the raw token (only
 * used by tests / logging — never sent in a body).
 */
export async function attachSession(
  res: NextResponse,
  employeeId: string,
  req: NextRequest
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await db.employeeSession.create({
    data: {
      id: sha256(token),
      employeeId,
      createdAt: new Date(now),
      lastSeenAt: new Date(now),
      expiresAt: new Date(now + SESSION_TTL_MS),
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    },
  });
  // opportunistic cleanup: drop expired rows for this employee
  await db.employeeSession
    .deleteMany({ where: { employeeId, expiresAt: { lt: new Date(now) } } })
    .catch(() => {});
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS / 1000));
}

/** Resolve the signed-in employee from the request cookie, or null. */
export async function sessionEmployee(
  req: NextRequest
): Promise<SessionEmployee | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 64) return null;
  const hashed = sha256(token);
  const row = await db.employeeSession
    .findUnique({
      where: { id: hashed },
      include: { employee: true },
    })
    .catch(() => null);
  if (!row) return null;
  if (!sameHash(hashed, row.id)) return null; // defensive — findUnique already matched
  if (row.expiresAt.getTime() < Date.now()) {
    await db.employeeSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  const emp = row.employee;
  if (!emp.active) {
    await db.employeeSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  // r57: a suspended venue is disconnected from the platform — its staff
  // cannot operate even with a live session
  if (emp.venueId) {
    const venue = await db.venue
      .findUnique({ where: { id: emp.venueId }, select: { status: true } })
      .catch(() => null);
    if (venue && venue.status === "suspended") return null;
  }
  // sliding window: refresh lastSeen + expiry (best-effort, never fails the call)
  await db.employeeSession
    .update({
      where: { id: row.id },
      data: {
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })
    .catch(() => {});
  return {
    id: emp.id,
    name: emp.name,
    role: emp.role,
    permissions: resolvePermissions(emp.role, emp.permissions),
    venueId: emp.venueId ?? null,
    branchId: emp.branchId ?? null,
  };
}

/** Delete the session row + clear the cookie (sign out). */
export async function clearSession(
  res: NextResponse,
  req: NextRequest
): Promise<void> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.employeeSession
      .delete({ where: { id: sha256(token) } })
      .catch(() => {});
  }
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}

/**
 * Guard for staff-only API routes. Returns the employee when the caller has
 * a valid session (and the optional permission); returns a 401/403 response
 * otherwise — the route just does `if (resp) return resp;`.
 */
export async function requireStaff(
  req: NextRequest,
  permission?: Permission
): Promise<{ emp: SessionEmployee } | { resp: NextResponse }> {
  const emp = await sessionEmployee(req);
  if (!emp) {
    return {
      resp: NextResponse.json(
        { ok: false, error: "Sign-in required" },
        { status: 401 }
      ),
    };
  }
  if (permission && !emp.permissions.includes(permission)) {
    return {
      resp: NextResponse.json(
        { ok: false, error: "You do not have permission to do that" },
        { status: 403 }
      ),
    };
  }
  return { emp };
}

/** r70 replacement for the old requirePlatformAdmin(employeeId-param). */
export async function requirePlatformAdminSession(req: NextRequest) {
  const emp = await sessionEmployee(req);
  if (!emp) {
    return {
      resp: NextResponse.json(
        { ok: false, error: "Sign-in required" },
        { status: 401 }
      ),
    } as const;
  }
  if (emp.role !== "platform_admin") {
    return {
      resp: NextResponse.json(
        { ok: false, error: "Platform admin only" },
        { status: 403 }
      ),
    } as const;
  }
  return { emp } as const;
}

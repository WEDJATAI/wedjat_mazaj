import { db } from "@/lib/db";

/**
 * r61 — shared platform-admin guard for the Control Center APIs.
 *
 * The platform owner (role=platform_admin) controls the PLATFORM — its
 * shisha operation, menu, staff, finance and the venue lifecycle — but
 * never reaches into a registered venue's own (non-shisha) business.
 */

export async function requirePlatformAdmin(employeeId: string | null) {
  if (!employeeId) return null;
  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  if (!emp || !emp.active || emp.role !== "platform_admin") return null;
  return emp;
}

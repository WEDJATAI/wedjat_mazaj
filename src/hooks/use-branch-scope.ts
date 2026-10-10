"use client";

import { useSession } from "@/store/session";
import { useI18n } from "@/store/i18n";

/**
 * r57 — the branch scope every staff panel consumes.
 *
 * Reads the signed-in employee's working branch from the session store:
 *   branchId === null  → the floater/venue-admin "all branches" scope
 *                        (fetch APIs with ?branchId=all → aggregate views)
 *   branchId = string  → a concrete branch (fetch ?branchId=<id>)
 *
 * Returns the query param ready to append (`?branchId=…`), display info,
 * and whether this user may float (switcher visible).
 */
export function useBranchScope() {
  const employee = useSession((s) => s.employee);
  const lang = useI18n((s) => s.lang);
  const t = useI18n((s) => s.t);

  const branchId = employee?.branchId ?? null;
  const branches = employee?.branches ?? [];
  const isFloater =
    (employee?.role === "venue_admin" || employee?.role === "super_admin") &&
    branches.length > 1;

  const current =
    branches.find((b) => b.id === branchId) ?? null;
  const branchName = current
    ? (lang === "ar" && current.nameAr) || current.name
    : isFloater
    ? t("allBranches")
    : null;

  return {
    /** concrete branch id, or null = all-branches aggregate scope */
    branchId,
    /** the value for the API `?branchId=` param ("all" when floating) */
    branchParam: branchId ?? "all",
    /** localized display name of the current scope */
    branchName,
    /** branches this employee can switch between */
    branches,
    /** whether the dashboard should render the branch switcher */
    isFloater,
    /** platform admins don't operate lounge tabs at all */
    isPlatformAdmin: employee?.role === "platform_admin",
  };
}

import { db } from "@/lib/db";

/**
 * r57 — branch scoping helpers (multi-tenant platform).
 *
 * Every operational API takes an optional `branchId` query/body param:
 *   - explicit branch id → that branch (must exist + be active)
 *   - "all"              → null (the caller wants the venue-wide aggregate;
 *                          only meaningful for multi-branch admins, the
 *                          UI enforces that, APIs just return the scope)
 *   - missing            → the venue's flagship/first active branch
 *                          (single-branch venues and legacy clients)
 */

export interface BranchInfo {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  venueId: string;
  venueName: string;
  venueNameAr: string | null;
  isFlagship: boolean;
  isActive: boolean;
}

/** Serialize a branch (+venue) for client consumption. */
export function toBranchInfo(
  branch: {
    id: string;
    name: string;
    nameAr: string | null;
    slug: string;
    isFlagship: boolean;
    isActive: boolean;
    venueId: string;
    venue?: { name: string; nameAr: string | null } | null;
  }
): BranchInfo {
  return {
    id: branch.id,
    name: branch.name,
    nameAr: branch.nameAr,
    slug: branch.slug,
    venueId: branch.venueId,
    venueName: branch.venue?.name ?? "",
    venueNameAr: branch.venue?.nameAr ?? null,
    isFlagship: branch.isFlagship,
    isActive: branch.isActive,
  };
}

/**
 * Resolve the effective branch for a request.
 * Returns { branchId: string } for a concrete branch or
 * { branchId: null } when the caller asked for the venue-wide scope.
 */
export async function resolveBranchScope(
  raw: string | null | undefined
): Promise<{ branchId: string | null }> {
  if (raw === "all" || raw === "ALL") return { branchId: null };
  if (raw) {
    const branch = await db.branch.findUnique({ where: { id: raw } });
    if (branch && branch.isActive) return { branchId: branch.id };
    // unknown/inactive id → fall through to default rather than 500:
    // guests deep-linked to a closed branch still deserve a working menu
  }
  // default: the first active branch of the first active venue, flagship
  // preferred (the platform's home venue)
  const fallback = await db.branch.findFirst({
    where: { isActive: true, venue: { status: "active" } },
    orderBy: [{ isFlagship: "desc" }, { createdAt: "asc" }],
    include: { venue: true },
  });
  return { branchId: fallback?.id ?? null };
}

/** All active branches of all active venues (guest check-in picker). */
export async function listActiveBranches(): Promise<BranchInfo[]> {
  const rows = await db.branch.findMany({
    where: { isActive: true, venue: { status: "active" } },
    orderBy: [{ venueId: "asc" }, { isFlagship: "desc" }, { name: "asc" }],
    include: { venue: true },
  });
  return rows.map(toBranchInfo);
}

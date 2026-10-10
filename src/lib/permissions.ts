// Role + permission definitions for employee access control.
//
// r57 roles: platform_admin (platform owner console — onboards venues),
// venue_admin (owner of one multi-branch venue), super_admin, admin,
// employee. Permissions are stored as a comma-separated string on the
// Employee record (empty = fall back to the role's default set).

export type Role =
  | "platform_admin"
  | "venue_admin"
  | "super_admin"
  | "admin"
  | "employee";

export const ROLES: { value: Role; label: string; desc: string }[] = [
  {
    value: "platform_admin",
    label: "Platform owner",
    desc: "Super admin of the whole platform — onboards & connects venues",
  },
  {
    value: "venue_admin",
    label: "Venue admin",
    desc: "Owner of one venue — all branches, total inventory, staff",
  },
  {
    value: "super_admin",
    label: "Super admin",
    desc: "Full access + manage employees & permissions",
  },
  {
    value: "admin",
    label: "Admin",
    desc: "Manage orders, inventory & requests",
  },
  {
    value: "employee",
    label: "Employee",
    desc: "Receive & prepare orders",
  },
];

// All permission keys = bottom tabs + management.
export const ALL_PERMISSIONS = [
  "queue", // receive/confirm orders (primary)
  "new_order", // create a manual order
  "inventory", // view/restock molasses + supplies
  "requests", // guest service requests
  "employees", // manage employees + permissions (super admin only)
  "purchases", // buy molasses packs / supply boxes (procurement)
  "profit", // profit dashboard (revenue, COGS, net profit)
  "rsm", // r59: WEDJAT RSM revenue-share dashboard (12% × 40%)
  "sync", // Wedjat RSM sync status (admin+)
  "analytics", // R49 analytics dashboard (trends, peaks, staff, feedback)
  "loyalty", // R49 loyalty program members (admin+)
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_META: Record<
  Permission,
  { label: string; desc: string }
> = {
  queue: { label: "Order queue", desc: "Receive & confirm guest orders" },
  new_order: { label: "New order", desc: "Create a manual order" },
  inventory: { label: "Inventory", desc: "View & restock stock" },
  requests: { label: "Requests", desc: "Handle guest service calls" },
  employees: { label: "Employees", desc: "Manage staff & permissions" },
  purchases: { label: "Purchases", desc: "Buy molasses packs & supplies" },
  profit: { label: "Profit", desc: "Revenue, COGS & net profit" },
  rsm: {
    label: "RSM",
    desc: "WEDJAT revenue share — 12% on shisha × our 40%",
  },
  sync: { label: "Sync", desc: "Wedjat RSM connection & sync status" },
  analytics: { label: "Analytics", desc: "Trends, peak hours, staff & feedback" },
  loyalty: { label: "Loyalty", desc: "Rewards members, points & tiers" },
};

// Default permission set per role.
// r57: platform_admin sees the Platform Console instead of the lounge
// tabs (empty = the console is their whole dashboard); venue_admin gets
// the full operational set across every branch of their venue.
export const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  platform_admin: [],
  super_admin: [...ALL_PERMISSIONS],
  venue_admin: [
    "queue",
    "new_order",
    "inventory",
    "requests",
    "employees",
    "purchases",
    "profit",
    "rsm",
    "sync",
    "analytics",
    "loyalty",
  ],
  admin: [
    "queue",
    "new_order",
    "inventory",
    "requests",
    "purchases",
    "profit",
    "rsm",
    "sync",
    "analytics",
    "loyalty",
  ],
  employee: ["queue", "new_order", "requests"],
};

/** Parse a stored permissions string into a set of permission keys. */
export function parsePermissions(raw: string | null | undefined): Permission[] {
  if (!raw) return [];
  const set = new Set<Permission>();
  for (const part of raw.split(",")) {
    const p = part.trim() as Permission;
    if ((ALL_PERMISSIONS as readonly string[]).includes(p)) set.add(p);
  }
  return [...set];
}

/** Serialize permission keys back to a comma-separated string. */
export function serializePermissions(perms: Permission[]): string {
  return perms.join(",");
}

/**
 * Resolve the effective permissions for an employee: use their custom
 * permissions if set, otherwise the role default.
 */
export function resolvePermissions(
  role: string,
  customPerms: string | null | undefined
): Permission[] {
  const custom = parsePermissions(customPerms);
  if (custom.length > 0) return custom;
  const r = (role as Role) in ROLE_DEFAULTS ? (role as Role) : "employee";
  return ROLE_DEFAULTS[r];
}

export function hasPermission(
  perms: Permission[],
  p: Permission
): boolean {
  return perms.includes(p);
}

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin" || role === "platform_admin";
}

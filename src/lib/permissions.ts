// Role + permission definitions for employee access control.
//
// Three roles: super_admin, admin, employee.
// Super admin can customize which tabs each employee sees via `permissions`.
// Permissions are stored as a comma-separated string on the Employee record
// (empty = fall back to the role's default permission set).

export type Role = "super_admin" | "admin" | "employee";

export const ROLES: { value: Role; label: string; desc: string }[] = [
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
};

// Default permission set per role.
export const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  admin: ["queue", "new_order", "inventory", "requests"],
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
  return role === "super_admin";
}

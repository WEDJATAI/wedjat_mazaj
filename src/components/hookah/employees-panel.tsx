"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Users,
  RefreshCw,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ROLES,
  ALL_PERMISSIONS,
  PERMISSION_META,
  type Role,
  type Permission,
  resolvePermissions,
} from "@/lib/permissions";

interface EmployeeRow {
  id: string;
  name: string;
  pin: string;
  role: string;
  permissions: Permission[];
  active: boolean;
  createdAt: string;
}

const ROLE_BADGE_CLS: Record<string, string> = {
  super_admin: "border border-amber-400/40 bg-amber-400/15 text-amber-400",
  admin: "border border-primary/30 bg-primary/15 text-primary",
  employee: "border border-border bg-muted/60 text-muted-foreground",
};

export function EmployeesPanel({ onSignOut }: { onSignOut: () => void }) {
  const [rows, setRows] = React.useState<EmployeeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<EmployeeRow | "new" | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (data.ok) setRows(data.employees);
      else toast.error("Could not load employees");
    } catch {
      toast.error("Could not load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (emp: EmployeeRow) => {
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !emp.active }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      toast.success(emp.active ? "Deactivated" : "Reactivated");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const remove = async (emp: EmployeeRow) => {
    if (!confirm(`Remove ${emp.name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      toast.success("Employee removed");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    }
  };

  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Users className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">
                Employees
              </p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                Manage staff, roles & permissions
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={load}
                aria-label="Refresh"
              >
                <RefreshCw className="size-4" />
              </Button>
              <Button
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => setEditing("new")}
              >
                <Plus className="size-4" /> Add
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={onSignOut}
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {ROLES.map((r) => {
                const group = rows.filter((e) => e.role === r.value);
                if (group.length === 0) return null;
                return (
                  <div key={r.value}>
                    <div className="mb-2 flex items-center gap-2">
                      <h2 className="text-sm font-semibold">{r.label}</h2>
                      <Badge variant="secondary" className="bg-muted/60 text-muted-foreground">
                        {group.length}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.desc}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.map((emp) => {
                        const perms =
                          emp.permissions.length > 0
                            ? emp.permissions
                            : resolvePermissions(emp.role, null);
                        return (
                          <div
                            key={emp.id}
                            className={cn(
                              "rounded-2xl border bg-card p-4",
                              emp.active ? "border-border" : "border-border opacity-60"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="grid size-9 place-items-center rounded-xl bg-muted/60 text-lg">
                                  <ShieldCheck className="size-5 text-primary" />
                                </span>
                                <div>
                                  <p className="font-semibold">
                                    {emp.name}
                                    {!emp.active && (
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        (inactive)
                                      </span>
                                    )}
                                  </p>
                                  <p className="font-mono text-[11px] text-muted-foreground">
                                    PIN {emp.pin}
                                  </p>
                                </div>
                              </div>
                              <Badge
                                variant="secondary"
                                className={ROLE_BADGE_CLS[emp.role] ?? ROLE_BADGE_CLS.employee}
                              >
                                {ROLES.find((x) => x.value === emp.role)?.label ?? emp.role}
                              </Badge>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {perms.map((p) => (
                                <span
                                  key={p}
                                  className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                                >
                                  {PERMISSION_META[p]?.label ?? p}
                                </span>
                              ))}
                            </div>

                            <div className="mt-3 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => setEditing(emp)}
                              >
                                <Pencil className="size-3.5" /> Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => toggleActive(emp)}
                              >
                                {emp.active ? "Deactivate" : "Activate"}
                              </Button>
                              <button
                                type="button"
                                onClick={() => remove(emp)}
                                className="ml-auto grid place-items-center rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Remove ${emp.name}`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <EditSheet
        employee={editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onDone={load}
      />
    </div>
  );
}

function EditSheet({
  employee,
  open,
  onOpenChange,
  onDone,
}: {
  employee: EmployeeRow | "new" | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const isNew = employee === "new";
  const existing = !isNew ? (employee as EmployeeRow | null) : null;
  const [name, setName] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [role, setRole] = React.useState<Role>("employee");
  const [perms, setPerms] = React.useState<Permission[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (isNew) {
      setName("");
      setPin("");
      setRole("employee");
      setPerms(resolvePermissions("employee", null));
    } else if (existing) {
      setName(existing.name);
      setPin(existing.pin);
      setRole(existing.role as Role);
      setPerms(
        existing.permissions.length > 0
          ? existing.permissions
          : resolvePermissions(existing.role, null)
      );
    }
  }, [employee, isNew, existing]);

  const togglePerm = (p: Permission) => {
    setPerms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  // When role changes (new employee), reset perms to that role's default unless
  // the user has already customized.
  const onRoleChange = (r: Role) => {
    setRole(r);
    setPerms(resolvePermissions(r, null));
  };

  const submit = async () => {
    if (!name.trim() || pin.length !== 4) {
      toast.error("Name and a 4-digit PIN are required");
      return;
    }
    setSaving(true);
    try {
      const url = isNew ? "/api/employees" : `/api/employees/${existing!.id}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), pin, role, permissions: perms }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      toast.success(isNew ? "Employee created" : "Employee updated");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-border p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            {isNew ? "Add employee" : `Edit ${existing?.name ?? ""}`}
          </SheetTitle>
          <SheetDescription>
            Set the role and choose which tabs this person can access.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-5 pb-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Karim"
              aria-label="Employee name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">PIN (4 digits)</Label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              inputMode="numeric"
              maxLength={4}
              aria-label="Employee PIN"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Role</Label>
            <div className="grid gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => onRoleChange(r.value)}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border p-3 text-left transition-all",
                    role === r.value
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Tab access (permissions)
            </Label>
            <div className="grid gap-2">
              {ALL_PERMISSIONS.map((p) => {
                const on = perms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePerm(p)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all",
                      on
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-md border text-[10px]",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-transparent"
                      )}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {PERMISSION_META[p]?.label ?? p}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {PERMISSION_META[p]?.desc ?? ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-border px-5 py-4">
          <Button
            className="w-full rounded-xl"
            size="lg"
            disabled={saving || !name.trim() || pin.length !== 4}
            onClick={submit}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isNew ? (
              "Create employee"
            ) : (
              "Save changes"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Crown,
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
import {
  AppHeader,
  EmptyState,
  GoldButton,
  Kicker,
  StatTile,
  Stagger,
  StaggerItem,
} from "./kit/kit";

interface EmployeeRow {
  id: string;
  name: string;
  pin: string;
  role: string;
  permissions: Permission[];
  active: boolean;
  createdAt: string;
}

/** Gold-ring role pills (Midnight Ember). */
const ROLE_BADGE_CLS: Record<string, string> = {
  super_admin:
    "rounded-full border-transparent bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/50",
  admin: "rounded-full border-transparent bg-primary/15 text-primary ring-1 ring-primary/45",
  employee:
    "rounded-full border-transparent bg-white/[0.04] text-muted-foreground ring-1 ring-white/10",
};

/* ── Midnight Ember shared bits (panel-local) ─────────────────────────── */

const glassIconBtn =
  "glass grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground active:scale-95";

const glassPillBtn =
  "inline-flex h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-xs font-semibold text-foreground/90 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-white/[0.07] active:scale-[0.97]";

const inputCls =
  "h-11 rounded-xl border-white/[0.08] bg-white/[0.04] shadow-none focus-visible:border-primary/50 focus-visible:ring-primary/25";

const fieldLabelCls =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

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

  const activeCount = rows.filter((e) => e.active).length;
  const adminCount = rows.filter(
    (e) => e.role === "admin" || e.role === "super_admin"
  ).length;

  return (
    <div className="dark relative flex min-h-screen flex-col text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <AppHeader
          icon={<Users className="size-5" />}
          title="Staff"
          subtitle="Manage staff, roles & permissions"
          actions={
            <>
              <button
                type="button"
                onClick={load}
                aria-label="Refresh"
                title="Refresh"
                className={glassIconBtn}
              >
                <RefreshCw className="size-4" />
              </button>
              <GoldButton
                size="sm"
                className="h-11 normal-case tracking-wide"
                onClick={() => setEditing("new")}
              >
                <Plus className="size-4" /> Add
              </GoldButton>
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
                className={glassIconBtn}
              >
                <LogOut className="size-4" />
              </button>
            </>
          }
        />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-44 pt-6 sm:px-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.05]" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={<Users className="size-6" />}
              title="No staff yet"
              description="Add your first team member to get started."
            />
          ) : (
            <div className="space-y-8">
              {/* Team pulse — gold stat tiles */}
              <div className="grid grid-cols-3 gap-3">
                <StatTile
                  icon={<Users className="size-4" />}
                  text={String(rows.length)}
                  label="Team"
                />
                <StatTile
                  icon={<ShieldCheck className="size-4" />}
                  text={String(activeCount)}
                  label="Active"
                />
                <StatTile
                  icon={<Crown className="size-4" />}
                  text={String(adminCount)}
                  label="Admins"
                />
              </div>

              {ROLES.map((r) => {
                const group = rows.filter((e) => e.role === r.value);
                if (group.length === 0) return null;
                return (
                  <section key={r.value}>
                    <div className="mb-1 flex items-center gap-2.5">
                      <Kicker>{r.label}</Kicker>
                      <span
                        className="grid h-5 min-w-5 place-items-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary ring-1 ring-primary/35"
                        aria-label={`${group.length} staff`}
                      >
                        {group.length}
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {r.desc}
                    </p>
                    <Stagger className="space-y-2.5">
                      {group.map((emp) => (
                        <StaggerItem key={emp.id}>
                          <EmployeeCard
                            emp={emp}
                            onEdit={() => setEditing(emp)}
                            onToggle={() => toggleActive(emp)}
                            onRemove={() => remove(emp)}
                          />
                        </StaggerItem>
                      ))}
                    </Stagger>
                  </section>
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

function EmployeeCard({
  emp,
  onEdit,
  onToggle,
  onRemove,
}: {
  emp: EmployeeRow;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const perms =
    emp.permissions.length > 0
      ? emp.permissions
      : resolvePermissions(emp.role, null);
  return (
    <div
      className={cn(
        "glass rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]",
        !emp.active && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">
              {emp.name}
              {!emp.active && (
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  (inactive)
                </span>
              )}
            </p>
            <p className="mt-0.5 font-mono text-[11px] tracking-wider text-muted-foreground">
              PIN {emp.pin}
            </p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0",
            ROLE_BADGE_CLS[emp.role] ?? ROLE_BADGE_CLS.employee
          )}
        >
          {ROLES.find((x) => x.value === emp.role)?.label ?? emp.role}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {perms.map((p) => (
          <span
            key={p}
            className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[11px] text-foreground/70"
          >
            {PERMISSION_META[p]?.label ?? p}
          </span>
        ))}
      </div>

      <div className="ember-hairline mt-3.5" aria-hidden />

      <div className="mt-3 flex items-center gap-2">
        <button type="button" className={glassPillBtn} onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit
        </button>
        <button type="button" className={glassPillBtn} onClick={onToggle}>
          {emp.active ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${emp.name}`}
          title={`Remove ${emp.name}`}
          className="ms-auto grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-white/[0.08] transition-all hover:bg-destructive/15 hover:text-destructive hover:ring-destructive/40 active:scale-95"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
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
        className="slim-scroll mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.155_0.014_60/0.92)] p-0 backdrop-blur-2xl"
      >
        <div
          className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/15"
          aria-hidden
        />
        <SheetHeader className="px-5 pt-2 pb-2">
          <SheetTitle className="flex items-center gap-3 font-display text-xl font-bold tracking-tight text-gold-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <ShieldCheck className="size-4" />
            </span>
            {isNew ? "Add employee" : `Edit ${existing?.name ?? ""}`}
          </SheetTitle>
          <SheetDescription>
            Set the role and choose which tabs this person can access.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-5 pb-4">
          <div className="space-y-1.5">
            <Label className={fieldLabelCls}>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Karim"
              aria-label="Employee name"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={fieldLabelCls}>PIN (4 digits)</Label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              inputMode="numeric"
              maxLength={4}
              aria-label="Employee PIN"
              className={cn(inputCls, "font-mono tracking-[0.3em]")}
            />
          </div>
          <div className="space-y-2">
            <Label className={fieldLabelCls}>Role</Label>
            <div className="grid gap-2">
              {ROLES.map((r) => {
                const selected = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => onRoleChange(r.value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl p-3.5 text-start transition-all duration-300 active:scale-[0.99]",
                      selected
                        ? "border border-primary/50 bg-primary/10 ring-1 ring-primary/40"
                        : "border border-white/[0.08] bg-white/[0.03] hover:border-primary/35 hover:bg-white/[0.05]"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
                        selected ? "border-primary" : "border-white/25"
                      )}
                      aria-hidden
                    >
                      {selected && (
                        <span className="size-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ember-hairline" aria-hidden />

          <div className="space-y-2">
            <Label className={fieldLabelCls}>
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
                    aria-pressed={on}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl p-2.5 text-start transition-all active:scale-[0.99]",
                      on
                        ? "border border-primary/45 bg-primary/10"
                        : "border border-white/[0.08] bg-white/[0.03] hover:border-primary/35"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border text-[10px] font-bold transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-white/15 bg-transparent text-transparent"
                      )}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <div className="min-w-0">
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

        <SheetFooter className="border-t border-white/[0.06] px-5 py-4">
          <GoldButton
            className="h-12 w-full text-sm"
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
          </GoldButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

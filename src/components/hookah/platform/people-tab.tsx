"use client";

/**
 * r61 — Platform Control Center · PEOPLE tab.
 *
 * The platform owner's account directory: every employee across every
 * venue with their role + scope, one-tap enable/disable, and account
 * creation (platform-level or venue-scoped). PINs are never displayed —
 * the platform owner manages accounts, not credentials.
 */

import * as React from "react";
import {
  Building2,
  Loader2,
  LogOut,
  MapPin,
  Power,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  WifiOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";
import { useI18n } from "@/store/i18n";
import { EmptyState, GoldButton, Kicker, Stagger, StaggerItem } from "../kit/kit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Person {
  id: string;
  name: string;
  role: string;
  active: boolean;
  venue: { id: string; name: string; nameAr: string | null } | null;
  branch: { id: string; name: string; nameAr: string | null } | null;
  createdAt: string;
  /** r71 — live session count (0 when disabled) for the online badge */
  activeSessions?: number;
}

const ROLE_LABEL: Record<string, { key: string; cls: string }> = {
  platform_admin: { key: "pccRolePlatform", cls: "bg-primary/10 text-primary ring-primary/30" },
  venue_admin: { key: "pccRoleVenueAdmin", cls: "bg-amber-500/10 text-amber-300 ring-amber-500/30" },
  super_admin: { key: "pccRoleSuper", cls: "bg-rose-500/10 text-rose-300 ring-rose-500/30" },
  admin: { key: "pccRoleAdmin", cls: "bg-white/[0.06] text-foreground/80 ring-white/[0.12]" },
  employee: { key: "pccRoleEmployee", cls: "bg-white/[0.06] text-foreground/80 ring-white/[0.12]" },
};

function pickName(name: string, nameAr: string | null, lang: Lang): string {
  return lang === "ar" && nameAr ? nameAr : name;
}

/* ------------------------------------------------------------------ */
/* PeopleTab                                                           */
/* ------------------------------------------------------------------ */

export function PeopleTab({
  selfId,
}: {
  selfId: string;
}) {
  const { t, lang } = useI18n();
  const [people, setPeople] = React.useState<Person[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  /** r71 — session revocation confirm state */
  const [revokeTarget, setRevokeTarget] = React.useState<Person | null>(null);

  const load = React.useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(`/api/platform/employees`);
        const data = (await res.json()) as { ok?: boolean; error?: string; employees?: Person[] };
        if (!res.ok || !data.ok || !Array.isArray(data.employees)) {
          throw new Error(data.error ?? t("failed"));
        }
        setPeople(data.employees);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t("failed"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [t]
  );

  React.useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener("mazaj:platform-refresh", onRefresh);
    return () => window.removeEventListener("mazaj:platform-refresh", onRefresh);
  }, [load]);

  const toggleActive = React.useCallback(
    async (person: Person) => {
      setBusyId(person.id);
      try {
        const res = await fetch(`/api/platform/employees/${person.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            active: !person.active,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? t("failed"));
        toast.success(person.active ? t("pccPersonDisabled") : t("pccPersonEnabled"));
        void load(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("failed"));
      } finally {
        setBusyId(null);
      }
    },
    [load, t]
  );

  /** r71 — revoke every session for an account (sign out all devices). */
  const revokeSessions = React.useCallback(
    async (person: Person) => {
      setBusyId(person.id);
      try {
        const res = await fetch(`/api/platform/employees/${person.id}/sessions`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; revoked?: number };
        if (!res.ok || !data.ok) throw new Error(data.error ?? t("failed"));
        toast.success(
          t("pccSessionsRevoked", { n: data.revoked ?? 0, name: person.name })
        );
        setRevokeTarget(null);
        void load(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("failed"));
      } finally {
        setBusyId(null);
      }
    },
    [load, t]
  );

  const filtered = people.filter(
    (p) =>
      query.trim() === "" ||
      p.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      (p.venue?.name ?? "").toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Kicker className="justify-start">{t("pccPeopleTitle")}</Kicker>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("pccPeopleDesc")}</p>
        </div>
        <GoldButton size="sm" className="h-11" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">{t("pccAddPerson")}</span>
        </GoldButton>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("pccSearchPeople")}
        aria-label={t("pccSearchPeople")}
        className="mb-3 h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<WifiOff className="size-6" />}
          title={t("failed")}
          description={error}
          action={
            <GoldButton size="sm" className="h-11" onClick={() => void load()}>
              <RefreshCw className="size-3.5" aria-hidden />
              {t("retry")}
            </GoldButton>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={t("pccNoPeople")}
          description={t("pccNoPeopleDesc")}
        />
      ) : (
        <ul className="space-y-2">
          <Stagger className="space-y-2">
            {filtered.map((p) => {
              const role = ROLE_LABEL[p.role] ?? ROLE_LABEL.employee;
              const isSelf = p.id === selfId;
              const online = (p.activeSessions ?? 0) > 0;
              return (
                <StaggerItem key={p.id}>
                  <li
                    className={cn(
                      "glass flex items-center gap-3 rounded-2xl px-4 py-3",
                      !p.active && "opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-primary/20 to-primary/[0.05] text-primary ring-1 ring-primary/20"
                      )}
                      aria-hidden
                    >
                      <ShieldCheck className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground/90">
                        {p.name}
                        {isSelf && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary ring-1 ring-inset ring-primary/25">
                            {t("pccYou")}
                          </span>
                        )}
                        {online && (
                          <span
                            className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300 ring-1 ring-inset ring-emerald-500/25"
                            title={t("pccOnlineTitle", { n: p.activeSessions ?? 0 })}
                          >
                            <span className="me-1 inline-block size-1.5 rounded-full bg-emerald-400" aria-hidden />
                            {p.activeSessions} {t("pccOnline")}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        {p.venue ? (
                          <>
                            <Building2 className="size-3 shrink-0" aria-hidden />
                            {pickName(p.venue.name, p.venue.nameAr, lang)}
                            {p.branch && (
                              <>
                                <MapPin className="ms-1 size-3 shrink-0" aria-hidden />
                                {pickName(p.branch.name, p.branch.nameAr, lang)}
                              </>
                            )}
                          </>
                        ) : (
                          t("pccScopePlatform")
                        )}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset sm:inline-flex",
                        role.cls
                      )}
                    >
                      {t(role.key as never)}
                    </span>
                    {online && (
                      <button
                        type="button"
                        onClick={() => setRevokeTarget(p)}
                        disabled={busyId === p.id}
                        aria-label={t("pccRevokeSessions")}
                        title={t("pccRevokeSessions")}
                        className="grid size-11 shrink-0 place-items-center rounded-full text-amber-300 ring-1 ring-inset ring-amber-500/30 transition-colors hover:bg-amber-500/10"
                      >
                        {busyId === p.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <LogOut className="size-4" aria-hidden />
                        )}
                      </button>
                    )}
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => void toggleActive(p)}
                        disabled={busyId === p.id}
                        aria-label={p.active ? t("pccDisablePerson") : t("pccEnablePerson")}
                        className={cn(
                          "grid size-11 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors",
                          p.active
                            ? "text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/10"
                            : "text-muted-foreground ring-white/[0.12] hover:bg-white/[0.06]"
                        )}
                      >
                        {busyId === p.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Power className="size-4" aria-hidden />
                        )}
                      </button>
                    )}
                  </li>
                </StaggerItem>
              );
            })}
          </Stagger>
        </ul>
      )}

      <AddPersonDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        venues={people.flatMap((p) => (p.venue ? [p.venue] : []))}
        onDone={() => void load(true)}
      />

      {/* r71 — confirm before signing someone out of every device */}
      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
      >
        <AlertDialogContent className="border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-gold-soft">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-amber-500/25 to-amber-500/[0.06] text-amber-300 ring-1 ring-amber-500/25">
                <LogOut className="size-4" />
              </span>
              {t("pccRevokeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pccRevokeDesc", { name: revokeTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-xl border-white/[0.12]">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl bg-amber-500 text-black hover:bg-amber-400"
              onClick={() => revokeTarget && void revokeSessions(revokeTarget)}
            >
              <LogOut className="size-4" aria-hidden />
              {t("pccRevokeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* AddPersonDialog                                                     */
/* ------------------------------------------------------------------ */

function AddPersonDialog({
  open,
  onOpenChange,
  venues,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  venues: NonNullable<Person["venue"]>[];
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [role, setRole] = React.useState("employee");
  const [venueId, setVenueId] = React.useState("none");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setPin("");
      setRole("employee");
      setVenueId("none");
      setSending(false);
    }
  }, [open]);

  const uniqueVenues = React.useMemo(() => {
    const map = new Map<string, NonNullable<Person["venue"]>>();
    for (const v of venues) map.set(v.id, v);
    return [...map.values()];
  }, [venues]);

  const valid =
    name.trim().length >= 2 &&
    /^\d{4}$/.test(pin.trim()) &&
    (role === "platform_admin" ? venueId === "none" : true);

  const submit = async () => {
    if (!valid || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/platform/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          pin: pin.trim(),
          role,
          ...(venueId !== "none" && role !== "platform_admin" ? { venueId } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("failed"));
      toast.success(t("pccPersonAddedToast"));
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] backdrop-blur-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-gold-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
              <UserPlus className="size-4" />
            </span>
            {t("pccAddPerson")}
          </DialogTitle>
          <DialogDescription>{t("pccAddPersonDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pp-name" className="text-xs text-muted-foreground">
              {t("pccPersonName")}
            </Label>
            <Input
              id="pp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pp-pin" className="text-xs text-muted-foreground">
              {t("adminPin")}
            </Label>
            <Input
              id="pp-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              inputMode="numeric"
              autoComplete="off"
              className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04] tracking-[0.35em]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("pccRole")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/[0.08] bg-[oklch(0.175_0.015_60/0.97)]">
                {Object.entries(ROLE_LABEL).map(([value, meta]) => (
                  <SelectItem key={value} value={value} className="focus:bg-primary/15">
                    {t(meta.key as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role !== "platform_admin" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("pccVenueOptional")}</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.08] bg-[oklch(0.175_0.015_60/0.97)]">
                  <SelectItem value="none" className="focus:bg-primary/15">
                    {t("pccNoVenue")}
                  </SelectItem>
                  {uniqueVenues.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="focus:bg-primary/15">
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <GoldButton className="h-12 w-full" disabled={!valid || sending} onClick={() => void submit()}>
          {sending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="size-4" aria-hidden />
          )}
          {t("pccCreatePerson")}
        </GoldButton>
      </DialogContent>
    </Dialog>
  );
}

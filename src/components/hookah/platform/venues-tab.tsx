"use client";

/**
 * r61 — Platform Control Center · VENUES tab.
 *
 * Extracted from the r57 PlatformConsole (venue grid + onboarding +
 * branch growth + lifecycle actions). The console shell was dissolved
 * into the new tabbed PlatformControlCenter; this tab keeps everything
 * venue-related, self-loads its data, and listens for two window events
 * from the command palette: "mazaj:platform-refresh" and
 * "mazaj:platform-add-venue".
 */

import * as React from "react";
import {
  Building2,
  Coffee,
  Loader2,
  LogOut,
  MapPin,
  Pause,
  Plus,
  Star,
  UtensilsCrossed,
  WifiOff,
  Zap,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { egp } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";
import { useI18n } from "@/store/i18n";
import { EmptyState, GoldButton, Kicker, Stagger, StaggerItem } from "../kit/kit";

/* ------------------------------------------------------------------ */
/* Types — mirrors the /api/platform contract                           */
/* ------------------------------------------------------------------ */

export type VenueKind = "hookah" | "cafe" | "restaurant";
export type VenueStatus = "pending" | "active" | "suspended";

export interface PlatformBranch {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  isFlagship: boolean;
  isActive: boolean;
}

export interface PlatformVenue {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  kind: VenueKind;
  status: VenueStatus;
  createdAt: string;
  branches: PlatformBranch[];
  ordersToday: number;
  revenueToday: number;
}

const KINDS: Record<
  VenueKind,
  { labelKey: "kindHookah" | "kindCafe" | "kindRestaurant"; Icon: LucideIcon }
> = {
  hookah: { labelKey: "kindHookah", Icon: Flame },
  cafe: { labelKey: "kindCafe", Icon: Coffee },
  restaurant: { labelKey: "kindRestaurant", Icon: UtensilsCrossed },
};

const STATUS: Record<
  VenueStatus,
  { labelKey: "venueActive" | "venuePending" | "venueSuspended"; cls: string }
> = {
  active: {
    labelKey: "venueActive",
    cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  },
  pending: {
    labelKey: "venuePending",
    cls: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  },
  suspended: {
    labelKey: "venueSuspended",
    cls: "bg-destructive/15 text-destructive ring-destructive/30",
  },
};

function pickName(name: string, nameAr: string | null, lang: Lang): string {
  return lang === "ar" && nameAr ? nameAr : name;
}

/* ------------------------------------------------------------------ */
/* VenuesTab                                                           */
/* ------------------------------------------------------------------ */

export function VenuesTab({ employeeId }: { employeeId: string }) {
  const { t } = useI18n();

  const [venues, setVenues] = React.useState<PlatformVenue[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [branchVenue, setBranchVenue] = React.useState<PlatformVenue | null>(null);
  const [busyVenueId, setBusyVenueId] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(
          `/api/platform/venues?employeeId=${encodeURIComponent(employeeId)}`
        );
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          venues?: PlatformVenue[];
        };
        if (!res.ok || !data.ok || !Array.isArray(data.venues)) {
          throw new Error(data.error ?? t("failed"));
        }
        setVenues(data.venues);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t("failed"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [employeeId, t]
  );

  React.useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), 30_000);
    const onRefresh = () => void load();
    const onAdd = () => setAddOpen(true);
    window.addEventListener("mazaj:platform-refresh", onRefresh);
    window.addEventListener("mazaj:platform-add-venue", onAdd);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("mazaj:platform-refresh", onRefresh);
      window.removeEventListener("mazaj:platform-add-venue", onAdd);
    };
  }, [load]);

  const setVenueStatus = React.useCallback(
    async (venueId: string, status: VenueStatus) => {
      setBusyVenueId(venueId);
      try {
        const res = await fetch(`/api/platform/venues/${venueId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, status }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? t("failed"));
        toast.success(t("venueStatusUpdated"));
        void load(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("failed"));
      } finally {
        setBusyVenueId(null);
      }
    },
    [employeeId, load, t]
  );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Kicker className="justify-start">{t("venues")}</Kicker>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("venuesDesc")}</p>
        </div>
        <GoldButton size="sm" className="h-11" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">{t("addVenue")}</span>
        </GoldButton>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<WifiOff className="size-6" />}
          title={t("failed")}
          description={error}
          action={
            <GoldButton size="sm" className="h-11" onClick={() => void load()}>
              {t("retry")}
            </GoldButton>
          }
        />
      ) : venues.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title={t("noVenues")}
          description={t("noVenuesDesc")}
          action={
            <GoldButton size="sm" className="h-11" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              {t("addVenue")}
            </GoldButton>
          }
        />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2">
          {venues.map((v) => (
            <StaggerItem key={v.id} className="h-full">
              <VenueCard
                venue={v}
                busy={busyVenueId === v.id}
                onSetStatus={setVenueStatus}
                onAddBranch={() => setBranchVenue(v)}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <AddVenueDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        employeeId={employeeId}
        onDone={() => void load(true)}
      />
      <AddBranchDialog
        venue={branchVenue}
        employeeId={employeeId}
        onOpenChange={(o) => {
          if (!o) setBranchVenue(null);
        }}
        onDone={() => void load(true)}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* VenueCard — one glass venue tile                                    */
/* ------------------------------------------------------------------ */

function VenueCard({
  venue,
  busy,
  onSetStatus,
  onAddBranch,
}: {
  venue: PlatformVenue;
  busy: boolean;
  onSetStatus: (venueId: string, status: VenueStatus) => void;
  onAddBranch: () => void;
}) {
  const { t, lang } = useI18n();
  const kind = KINDS[venue.kind];
  const status = STATUS[venue.status];
  const name = pickName(venue.name, venue.nameAr, lang);

  return (
    <article className="glass group flex h-full flex-col rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
          <kind.Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-lg font-bold tracking-tight text-gold-soft">
            {name}
          </p>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-foreground/75 ring-1 ring-inset ring-white/[0.08]">
            <kind.Icon className="size-3 text-primary" aria-hidden />
            {t(kind.labelKey)}
          </span>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset",
            status.cls
          )}
        >
          <span className="sr-only">{t("statusLabel")}: </span>
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {t(status.labelKey)}
        </span>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/75">
          {t("branchesOf")}{" "}
          <span className="font-display text-gold-soft">· {venue.branches.length}</span>
        </p>
        <ul className="space-y-1.5">
          {venue.branches.map((b) => (
            <li
              key={b.id}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 ring-1 ring-inset ring-white/[0.06]",
                !b.isActive && "opacity-50"
              )}
            >
              <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">
                {pickName(b.name, b.nameAr, lang)}
              </span>
              {b.isFlagship && (
                <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onAddBranch}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Plus className="size-4" aria-hidden />
          {t("addBranch")}
        </button>
      </div>

      <div className="ember-hairline my-4" aria-hidden />
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-inset ring-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("todayOrders")}
          </p>
          <p className="font-display mt-0.5 text-lg font-bold tabular-nums text-gold">
            {venue.ordersToday}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-inset ring-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("todayRevenue")}
          </p>
          <p className="font-display mt-0.5 text-lg font-bold tabular-nums text-gold">
            {egp(venue.revenueToday, lang)}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-4">
        {venue.status === "active" ? (
          <button
            type="button"
            onClick={() => onSetStatus(venue.id, "suspended")}
            disabled={busy}
            className="glass inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-destructive ring-1 ring-inset ring-destructive/25 transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Pause className="size-4" aria-hidden />
            )}
            {t("suspendVenue")}
          </button>
        ) : (
          <GoldButton
            className="h-11 w-full"
            disabled={busy}
            onClick={() => onSetStatus(venue.id, "active")}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Zap className="size-4" aria-hidden />
            )}
            {t("activateVenue")}
          </GoldButton>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* AddVenueDialog — onboard a café/restaurant (venue + flagship + admin) */
/* ------------------------------------------------------------------ */

export function AddVenueDialog({
  open,
  onOpenChange,
  employeeId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeId: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [kind, setKind] = React.useState<VenueKind>("hookah");
  const [branchName, setBranchName] = React.useState("");
  const [adminName, setAdminName] = React.useState("");
  const [adminPin, setAdminPin] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setNameAr("");
      setKind("hookah");
      setBranchName("");
      setAdminName("");
      setAdminPin("");
      setSending(false);
    }
  }, [open]);

  const valid =
    name.trim().length >= 2 &&
    branchName.trim().length >= 2 &&
    adminName.trim().length >= 2 &&
    /^\d{4}$/.test(adminPin.trim());

  const submit = async () => {
    if (!valid || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/platform/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          name: name.trim(),
          nameAr: nameAr.trim(),
          kind,
          branchName: branchName.trim(),
          adminName: adminName.trim(),
          adminPin: adminPin.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("failed"));
      toast.success(t("venueOnboardedToast"), {
        description: t("venueOnboardedToastDesc"),
      });
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
      <DialogContent className="max-h-[85dvh] overflow-y-auto border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] backdrop-blur-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-gold-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
              <Building2 className="size-4" />
            </span>
            {t("addVenue")}
          </DialogTitle>
          <DialogDescription>{t("addVenueDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pv-name" className="text-xs text-muted-foreground">
              {t("venueName")}
            </Label>
            <Input
              id="pv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pv-name-ar" className="text-xs text-muted-foreground">
              {t("venueNameAr")}
            </Label>
            <Input
              id="pv-name-ar"
              dir="auto"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("venueKind")}</Label>
            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label={t("venueKind")}
            >
              {(Object.keys(KINDS) as VenueKind[]).map((k) => {
                const meta = KINDS[k];
                const selected = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-center ring-1 ring-inset transition-all",
                      selected
                        ? "bg-primary/15 text-primary ring-primary/45 shadow-[0_8px_24px_-12px_oklch(0.72_0.145_60/0.6)]"
                        : "bg-white/[0.03] text-foreground/75 ring-white/[0.08] hover:bg-white/[0.06] hover:text-foreground"
                    )}
                  >
                    <meta.Icon className="size-5" aria-hidden />
                    <span className="text-[11px] font-semibold leading-tight">
                      {t(meta.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pv-branch" className="text-xs text-muted-foreground">
              {t("flagshipBranch")}
            </Label>
            <Input
              id="pv-branch"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder={t("flagshipBranchHint")}
              className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="pv-admin" className="text-xs text-muted-foreground">
                {t("adminName")}
              </Label>
              <Input
                id="pv-admin"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-pin" className="text-xs text-muted-foreground">
                {t("adminPin")}
              </Label>
              <Input
                id="pv-pin"
                value={adminPin}
                onChange={(e) =>
                  setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="••••"
                inputMode="numeric"
                autoComplete="off"
                className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04] tracking-[0.35em]"
              />
            </div>
          </div>
        </div>

        <GoldButton
          className="h-12 w-full"
          disabled={!valid || sending}
          onClick={() => void submit()}
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Zap className="size-4" aria-hidden />
          )}
          {t("connectVenue")}
        </GoldButton>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* AddBranchDialog — grow an existing venue's network                  */
/* ------------------------------------------------------------------ */

function AddBranchDialog({
  venue,
  employeeId,
  onOpenChange,
  onDone,
}: {
  venue: PlatformVenue | null;
  employeeId: string;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const [name, setName] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const open = venue !== null;

  React.useEffect(() => {
    if (open) {
      setName("");
      setNameAr("");
      setSending(false);
    }
  }, [open]);

  const submit = async () => {
    if (!venue || sending || name.trim().length < 2) return;
    setSending(true);
    try {
      const res = await fetch("/api/platform/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          venueId: venue.id,
          name: name.trim(),
          nameAr: nameAr.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("failed"));
      toast.success(t("branchAddedToast"));
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
      <DialogContent className="border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] backdrop-blur-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-gold-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
              <MapPin className="size-4" />
            </span>
            {t("addBranch")}
          </DialogTitle>
          <DialogDescription>
            {venue ? pickName(venue.name, venue.nameAr, lang) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pb-name" className="text-xs text-muted-foreground">
              {t("branchName")}
            </Label>
            <Input
              id="pb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("flagshipBranchHint")}
              className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pb-name-ar" className="text-xs text-muted-foreground">
              {t("venueNameAr")}
            </Label>
            <Input
              id="pb-name-ar"
              dir="auto"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
            />
          </div>
        </div>

        <GoldButton
          className="h-12 w-full"
          disabled={name.trim().length < 2 || sending}
          onClick={() => void submit()}
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          {t("addBranch")}
        </GoldButton>
      </DialogContent>
    </Dialog>
  );
}

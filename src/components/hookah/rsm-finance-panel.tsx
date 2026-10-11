"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Scale,
  RefreshCw,
  LogOut,
  Receipt,
  UtensilsCrossed,
  Landmark,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { egp } from "@/lib/catalog";
import {
  EmptyState,
  Kicker,
  Stagger,
  StaggerItem,
  StatTile,
} from "./kit/kit";
import { useI18n } from "@/store/i18n";
import { useSession } from "@/store/session";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SHISHA_COMMISSION_PCT,
  WEDJAT_SHARE_PCT,
  PARTNER_SHARE_PCT,
  WEDJAT_EFFECTIVE_PCT,
} from "@/lib/rsm-finance";

/**
 * r59 — WEDJAT RSM finance (Revenue Share Management).
 *
 * Gross profit on shisha = shisha revenue × 12% commission × 40% WEDJAT
 * share. The 12% lives on shisha ONLY (apart from the café/restaurant's
 * food & beverage orders) and the venue — the rented shisha corner — pays
 * the tax & VAT, so nothing tax-related touches the numbers here.
 */

type Range = "today" | "7d" | "30d" | "all";

interface RsmDay {
  date: string;
  revenue: number;
  commission: number;
  wedjatGross: number;
}
interface RsmBranchRow {
  branchId: string;
  name: string;
  nameAr: string | null;
  venueName: string | null;
  venueNameAr: string | null;
  orders: number;
  shishaRevenue: number;
  commission: number;
  wedjatGross: number;
  partnerShare: number;
}
interface RsmVenueRow {
  venueId: string;
  name: string;
  nameAr: string | null;
  kind: string;
  orders: number;
  shishaRevenue: number;
  commission: number;
  wedjatGross: number;
  partnerShare: number;
}
interface RsmData {
  ok: true;
  range: Range;
  scope: "platform" | "venue";
  summary: {
    orderCount: number;
    hookahCount: number;
    grossSales: number;
    discounts: number;
    shishaRevenue: number;
    commission: number;
    wedjatGross: number;
    partnerShare: number;
    effectivePct: number;
  };
  days: RsmDay[];
  branches: RsmBranchRow[];
  venues: RsmVenueRow[];
  sync: {
    synced: number;
    pending: number;
    failed: number;
    revoked: number;
    syncedRevenue: number;
  };
}

const RANGES: { key: Range; labelKey: "rsmRangeToday" | "rsmRange7" | "rsmRange30" | "rsmRangeAll" }[] = [
  { key: "today", labelKey: "rsmRangeToday" },
  { key: "7d", labelKey: "rsmRange7" },
  { key: "30d", labelKey: "rsmRange30" },
  { key: "all", labelKey: "rsmRangeAll" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared body — everything below the header (used by the staff tab AND the
// platform console section).
// ─────────────────────────────────────────────────────────────────────────────

function RsmBody({
  data,
  range,
  onRange,
}: {
  data: RsmData | null;
  range: Range;
  onRange: (r: Range) => void;
}) {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const reduced = useReducedMotion();
  const s = data?.summary;

  return (
    <>
      {/* range toggle */}
      <div
        className="glass inline-flex items-center gap-1 rounded-full p-1"
        role="group"
        aria-label="Range"
      >
        {RANGES.map((r) => {
          const active = range === r.key;
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={active}
              onClick={() => onRange(r.key)}
              className={cn(
                "relative min-h-9 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-300",
                active
                  ? "text-[oklch(0.17_0.03_50)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId={reduced ? undefined : "rsm-range-pill"}
                  className="absolute inset-0 rounded-full bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)]"
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{t(r.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* the money row */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Flame className="size-4" />}
          text={egp(s?.shishaRevenue ?? 0, lang)}
          label={
            <>
              {t("rsmShishaRevenue")}
              <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                {s?.orderCount ?? 0} {t("rsmOrders")} · {s?.hookahCount ?? 0}{" "}
                {t("rsmHookahs")}
              </span>
            </>
          }
        />
        <StatTile
          icon={<Receipt className="size-4 text-amber-400" />}
          text={egp(s?.commission ?? 0, lang)}
          label={
            <>
              {t("rsmCommission")}
              <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                {t("rsmCommissionSub")}
              </span>
            </>
          }
        />
        <StatTile
          className="ring-1 ring-primary/25"
          icon={<Landmark className="size-4" />}
          text={egp(s?.wedjatGross ?? 0, lang)}
          label={
            <>
              {t("rsmWedjatGross")}
              <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                {t("rsmWedjatGrossSub")}
              </span>
            </>
          }
        />
        <StatTile
          icon={<Scale className="size-4 text-zinc-400" />}
          text={egp(s?.partnerShare ?? 0, lang)}
          label={
            <>
              {t("rsmPartnerShare")}
              <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                {t("rsmEffective")}
              </span>
            </>
          }
        />
      </div>

      {/* formula + share waterfall */}
      <section className="glass relative mt-4 overflow-hidden rounded-2xl p-4">
        <div
          className="pointer-events-none absolute -top-10 end-0 size-32 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-2">
          <p className="font-display text-sm font-bold tracking-tight text-gold-soft">
            {t("rsmFormula")}
          </p>
          <span className="shrink-0 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
            {WEDJAT_EFFECTIVE_PCT}%
          </span>
        </div>

        <div className="relative mt-3.5 space-y-2.5">
          {[
            {
              label: t("rsmShishaRevenue"),
              value: egp(s?.shishaRevenue ?? 0, lang),
              pct: 100,
              cls: "from-amber-500/45 to-amber-600/25",
              w: "100%",
            },
            {
              label: `${t("rsmCommission")}`,
              value: egp(s?.commission ?? 0, lang),
              pct: SHISHA_COMMISSION_PCT,
              cls: "from-amber-400/50 to-amber-500/25",
              w: "24%",
            },
            {
              label: t("rsmWedjatGross"),
              value: egp(s?.wedjatGross ?? 0, lang),
              pct: WEDJAT_EFFECTIVE_PCT,
              cls: "from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)]",
              w: "12%",
            },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-3">
              <p className="w-24 shrink-0 truncate text-[11px] font-medium text-muted-foreground sm:w-28">
                {row.label}
              </p>
              <div className="h-7 flex-1 overflow-hidden rounded-lg bg-white/[0.05]">
                <motion.div
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: row.w }}
                  transition={{ duration: 0.9, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "flex h-full items-center justify-end rounded-lg bg-gradient-to-r pe-2",
                    row.cls
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-bold tabular-nums",
                      i === 2 ? "text-[oklch(0.17_0.03_50)]" : "text-foreground"
                    )}
                  >
                    {row.value}
                  </span>
                </motion.div>
              </div>
              <span className="w-11 shrink-0 text-end text-[11px] font-bold tabular-nums text-muted-foreground">
                {row.pct === 100 ? "100%" : `${row.pct}%`}
              </span>
            </div>
          ))}
        </div>

        <div className="ember-hairline my-3.5" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {t("rsmGrossSales")}{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {egp(s?.grossSales ?? 0, lang)}
            </span>
          </span>
          <span className="text-muted-foreground">
            {t("rsmDiscounts")}{" "}
            <span className="font-semibold tabular-nums text-amber-400">
              −{egp(s?.discounts ?? 0, lang)}
            </span>
          </span>
        </div>
      </section>

      {/* tax + separation notes — the two owner rules, stated plainly */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="glass flex items-start gap-3 rounded-2xl border-amber-500/25 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
            <Receipt className="size-4" />
          </span>
          <p className="text-xs leading-relaxed text-foreground/90">
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">
              Tax &amp; VAT
            </span>
            {t("rsmTaxNote")}
          </p>
        </div>
        <div className="glass flex items-start gap-3 rounded-2xl p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <UtensilsCrossed className="size-4" />
          </span>
          <p className="text-xs leading-relaxed text-foreground/90">
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              {t("rsmShishaRevenue")} · 12%
            </span>
            {t("rsmSeparationNote")}
          </p>
        </div>
      </div>

      {/* daily trend */}
      {data && data.days.length > 0 && (
        <section className="mt-6">
          <Kicker className="mb-3">{t("rsmDailyTrend")}</Kicker>
          <div className="glass rounded-2xl p-4">
            <div className="flex h-28 items-end gap-1.5">
              {data.days.slice(-14).map((d, i) => {
                const max = Math.max(
                  ...data.days.slice(-14).map((x) => x.revenue),
                  1
                );
                const h = Math.max(4, (d.revenue / max) * 100);
                return (
                  <div
                    key={d.date}
                    className="group relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
                    title={`${d.date} · ${egp(d.revenue, lang)} · ${t("rsmWedjatGross")} ${egp(d.wedjatGross, lang)}`}
                  >
                    {/* fixed-height bar zone — % heights resolve against it */}
                    <div className="relative h-20 w-full">
                      <motion.div
                        initial={reduced ? false : { height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-7 rounded-t-md bg-gradient-to-t from-amber-600/40 to-[oklch(0.86_0.13_74)]"
                      />
                    </div>
                    <span className="text-[8px] font-medium tabular-nums text-muted-foreground">
                      {d.date.slice(8, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* by venue (platform scope) */}
      {data && data.scope === "platform" && data.venues.length > 0 && (
        <section className="mt-6">
          <Kicker className="mb-3">{t("rsmByVenue")}</Kicker>
          <Stagger className="space-y-2">
            {data.venues.map((v) => (
              <StaggerItem key={v.venueId}>
                <div className="glass flex items-center gap-3 rounded-2xl p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                    <Landmark className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {(lang === "ar" && v.nameAr) || v.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {v.orders} {t("rsmOrders")} · {egp(v.shishaRevenue, lang)}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-display text-sm font-bold tabular-nums text-gold">
                      {egp(v.wedjatGross, lang)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("rsmThOurs")}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* by branch */}
      {data && data.branches.length > 0 && (
        <section className="mt-6">
          <Kicker className="mb-3">{t("rsmByBranch")}</Kicker>
          <Stagger className="space-y-2">
            {data.branches.map((b) => (
              <StaggerItem key={b.branchId}>
                <div className="glass flex items-center gap-3 rounded-2xl p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08]">
                    <Flame className="size-4 text-amber-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {(lang === "ar" && b.nameAr) || b.name}
                      {data.scope === "platform" && b.venueName && (
                        <span className="ms-1.5 text-[11px] font-normal text-muted-foreground">
                          · {(lang === "ar" && b.venueNameAr) || b.venueName}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.orders} {t("rsmOrders")} · {egp(b.shishaRevenue, lang)} ·{" "}
                      {t("rsmThCommission")} {egp(b.commission, lang)}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-display text-sm font-bold tabular-nums text-gold">
                      {egp(b.wedjatGross, lang)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("rsmThOurs")}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* Wedjat RSM sync status */}
      {data && (
        <section className="mt-6">
          <Kicker className="mb-3">{t("rsmSyncTitle")}</Kicker>
          <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3.5 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-400">
              <CheckCircle2 className="size-3.5" /> {data.sync.synced}{" "}
              {t("rsmSynced")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 font-medium text-foreground/85">
              <Clock className="size-3.5" /> {data.sync.pending}{" "}
              {t("rsmPending")}
            </span>
            {data.sync.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 font-semibold text-destructive">
                <XCircle className="size-3.5" /> {data.sync.failed}{" "}
                {t("rsmFailed")}
              </span>
            )}
            {data.sync.revoked > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 font-medium text-muted-foreground">
                <Ban className="size-3.5" /> {data.sync.revoked}{" "}
                {t("rsmRevoked")}
              </span>
            )}
            {data.sync.syncedRevenue > 0 && (
              <span className="ms-auto font-display font-bold tabular-nums text-gold">
                {egp(data.sync.syncedRevenue, lang)}
              </span>
            )}
          </div>
        </section>
      )}

      {data && data.summary.orderCount === 0 && (
        <EmptyState
          className="mt-6 py-10"
          icon={<Flame className="size-7" />}
          title={t("rsmNoData")}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff tab — full screen with header, branch scope, sign-out.
// ─────────────────────────────────────────────────────────────────────────────

export function RsmFinancePanel({ onSignOut }: { onSignOut: () => void }) {
  const t = useI18n((s) => s.t);
  const employee = useSession((s) => s.employee);
  const { branchParam, branchName } = useBranchScope();
  const [range, setRange] = React.useState<Range>("7d");
  const [data, setData] = React.useState<RsmData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/rsm/finance?employeeId=${encodeURIComponent(employee.id)}&range=${range}&branchId=${branchParam}`
      );
      const json = await res.json();
      if (json.ok) setData(json as RsmData);
    } catch {
      // silent — skeleton stays
    } finally {
      setLoading(false);
    }
  }, [employee?.id, range, branchParam]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="dark relative flex min-h-screen flex-col text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[oklch(0.155_0.014_60/0.72)] backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Scale className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="font-display truncate text-xl font-bold tracking-tight text-gold-soft">
                {t("rsmTitle")}
              </h1>
              <p className="-mt-0.5 truncate text-[11px] text-muted-foreground">
                {t("rsmSubtitle")}
                {branchName ? ` · ${branchName}` : ""}
              </p>
            </div>
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={load}
                aria-label="Refresh"
                className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-all hover:text-foreground active:scale-95"
              >
                <RefreshCw className="size-4" />
              </button>
              <button
                type="button"
                onClick={onSignOut}
                aria-label={t("signOut")}
                className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-all hover:text-foreground active:scale-95"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
          <div className="ember-hairline mx-auto w-full max-w-5xl" aria-hidden />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-44 pt-6 sm:px-5">
          {loading && !data ? (
            <div className="space-y-4">
              <Skeleton className="h-11 w-64 rounded-full bg-white/[0.05]" />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.05]" />
                ))}
              </div>
              <Skeleton className="h-48 rounded-2xl bg-white/[0.05]" />
            </div>
          ) : (
            <RsmBody data={data} range={range} onRange={setRange} />
          )}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform console section — same body, embedded under the venue pulse.
// ─────────────────────────────────────────────────────────────────────────────

export function RsmFinanceSection({
  employeeId,
}: {
  employeeId: string;
}) {
  const t = useI18n((s) => s.t);
  const [range, setRange] = React.useState<Range>("7d");
  const [data, setData] = React.useState<RsmData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/rsm/finance?employeeId=${encodeURIComponent(employeeId)}&range=${range}`
      );
      const json = await res.json();
      if (json.ok) setData(json as RsmData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [employeeId, range]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mt-8">
      <Kicker className="mb-1">{t("rsmPlatformSection")}</Kicker>
      <p className="mb-3 text-xs text-muted-foreground">
        {t("rsmPlatformSectionDesc")}
      </p>
      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-11 w-64 rounded-full bg-white/[0.05]" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        </div>
      ) : (
        <RsmBody data={data} range={range} onRange={setRange} />
      )}
    </section>
  );
}

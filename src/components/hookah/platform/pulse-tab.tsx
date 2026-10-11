"use client";

/**
 * r61 — Platform Control Center · PULSE (the command dashboard).
 *
 * The platform owner's live mission-control view:
 *   • KPI row   — today's orders, revenue, commission, WEDJAT gross
 *   • Trend     — 7-day revenue bars with the WEDJAT-gross baseline
 *   • Activity  — the freshest shisha orders across every venue
 *   • Ops       — low stock / pending requests / Wedjat sync / DB health
 *
 * Self-loads /api/platform/pulse with a 20s silent poll (it's a live
 * dashboard), refreshes on the palette's "mazaj:platform-refresh" event.
 */

import * as React from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Bell,
  Building2,
  Coins,
  Database,
  Landmark,
  RefreshCw,
  ShoppingBag,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { egp } from "@/lib/catalog";
import { useI18n } from "@/store/i18n";
import {
  CineCard,
  EmptyState,
  GoldButton,
  Kicker,
  StatTile,
  Stagger,
  StaggerItem,
} from "../kit/kit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface PulseData {
  ok: boolean;
  health: { dbUp: boolean; latencyMs: number; time: string };
  network: { venues: number; activeVenues: number; pendingVenues: number; branches: number };
  today: {
    orders: number;
    hookahs: number;
    revenue: number;
    commission: number;
    wedjatGross: number;
  };
  trend7d: { date: string; revenue: number; wedjatGross: number }[];
  activity: {
    id: string;
    customer: string | null;
    table: string | null;
    total: number;
    hookahs: number;
    status: string;
    source: string;
    venue: string | null;
    branchId: string | null;
    createdAt: string;
  }[];
  ops: { lowStockCount: number; lowSuppliesCount: number; pendingRequests: number };
  wedjat: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function timeAgo(iso: string, lang: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (lang === "ar") {
    if (s < 60) return "الآن";
    if (m < 60) return `منذ ${m} د`;
    if (h < 24) return `منذ ${h} س`;
    return `منذ ${Math.floor(h / 24)} ي`;
  }
  if (s < 60) return "now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  preparing: "bg-sky-400",
  done: "bg-emerald-400",
};

/* ------------------------------------------------------------------ */
/* PulseTab                                                            */
/* ------------------------------------------------------------------ */

export function PulseTab({ employeeId }: { employeeId: string }) {
  const { t, lang } = useI18n();
  const [data, setData] = React.useState<PulseData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(
          `/api/platform/pulse?employeeId=${encodeURIComponent(employeeId)}`
        );
        const json = (await res.json()) as PulseData & { error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? t("failed"));
        setData(json);
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
    const id = window.setInterval(() => void load(true), 20_000);
    const onRefresh = () => void load();
    window.addEventListener("mazaj:platform-refresh", onRefresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("mazaj:platform-refresh", onRefresh);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
        <div className="h-44 animate-pulse rounded-2xl bg-white/[0.05]" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<WifiOff className="size-6" />}
        title={t("failed")}
        description={error ?? ""}
        action={
          <GoldButton size="sm" className="h-11" onClick={() => void load()}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t("retry")}
          </GoldButton>
        }
      />
    );
  }

  const maxTrend = Math.max(...data.trend7d.map((d) => d.revenue), 1);
  const trendSig = data.trend7d.map((d) => d.revenue).join("|");

  return (
    <div className="space-y-6">
      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StaggerItem>
          <StatTile
            icon={<Building2 className="size-4" />}
            value={data.network.activeVenues}
            label={t("pccActiveVenues")}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            icon={<ShoppingBag className="size-4" />}
            value={data.today.orders}
            label={t("todayOrders")}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            icon={<Coins className="size-4" />}
            text={egp(data.today.revenue, lang)}
            label={t("todayRevenue")}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            icon={<Landmark className="size-4" />}
            text={egp(data.today.commission, lang)}
            label={t("pccCommissionToday")}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            key={`wg-${trendSig}`}
            className="ring-1 ring-primary/25"
            icon={<Landmark className="size-4" />}
            text={egp(data.today.wedjatGross, lang)}
            label={t("rsmWedjatGross")}
          />
        </StaggerItem>
      </Stagger>

      {/* ── system + ops health strip ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
          <Database className="size-3" aria-hidden />
          {t("pccDbUp")} · {data.health.latencyMs}ms
        </span>
        {data.ops.lowStockCount + data.ops.lowSuppliesCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
            <AlertTriangle className="size-3" aria-hidden />
            {t("pccLowStockChip", {
              count: data.ops.lowStockCount + data.ops.lowSuppliesCount,
            })}
          </span>
        )}
        {data.ops.pendingRequests > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 ring-1 ring-inset ring-rose-500/30">
            <Bell className="size-3" aria-hidden />
            {t("pccPendingReqChip", { count: data.ops.pendingRequests })}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-foreground/75 ring-1 ring-inset ring-white/[0.08]">
          {t("pccWedjatChip", {
            synced: data.wedjat.synced ?? 0,
            pending: data.wedjat.pending ?? 0,
          })}
        </span>
      </div>

      {/* ── 7-day trend ─────────────────────────────────────────────── */}
      <CineCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Kicker className="justify-start">{t("pccTrendTitle")}</Kicker>
            <p className="mt-1 text-xs text-muted-foreground">{t("pccTrendDesc")}</p>
          </div>
          <span className="font-display text-sm font-bold text-gold-soft">
            {egp(
              data.trend7d.reduce((s, d) => s + d.revenue, 0),
              lang
            )}
          </span>
        </div>
        {/* fixed-height bar zone (percent heights collapse in auto parents) */}
        <div className="flex h-28 items-end gap-1.5" dir="ltr">
          {data.trend7d.map((d) => {
            const hPct = Math.max(4, Math.round((d.revenue / maxTrend) * 100));
            const wPct = Math.max(2, Math.round((d.wedjatGross / maxTrend) * 100));
            return (
              <div
                key={d.date}
                className="group relative flex h-full flex-1 flex-col justify-end"
                title={`${d.date} · ${egp(d.revenue, lang)}`}
              >
                <div
                  className="relative w-full rounded-t-md bg-gradient-to-t from-primary/25 to-primary/70 transition-all duration-500"
                  style={{ height: `${hPct}%` }}
                >
                  <div
                    className="absolute bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-t-full bg-gradient-to-t from-amber-300 to-amber-100"
                    style={{ height: `${Math.min(100, (wPct / hPct) * 100)}%` }}
                    aria-hidden
                  />
                </div>
                <span className="mt-1.5 text-center text-[10px] font-medium text-muted-foreground">
                  {d.date.slice(8)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary/70" aria-hidden />
            {t("pccTrendRevenue")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-200" aria-hidden />
            {t("rsmWedjatGross")}
          </span>
        </p>
      </CineCard>

      {/* ── live activity feed ───────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <Kicker className="justify-start">
            <ActivityIcon className="size-3.5" aria-hidden />
            {t("pccActivityTitle")}
          </Kicker>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            {t("pccLive")}
          </span>
        </div>

        {data.activity.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon className="size-6" />}
            title={t("pccNoActivity")}
            description={t("pccNoActivityDesc")}
          />
        ) : (
          <ul className="space-y-2">
            {data.activity.map((o) => (
              <li
                key={o.id}
                className="glass flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:border-primary/30"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    STATUS_DOT[o.status] ?? "bg-muted-foreground"
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground/90">
                    {o.customer ?? t("walkIn")} · {o.hookahs} {t("pccHookahsShort")}
                    {o.table ? ` · ${o.table}` : ""}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {o.venue ?? t("pccUnassigned")} · {timeAgo(o.createdAt, lang)}
                  </p>
                </div>
                <span className="font-display shrink-0 text-sm font-bold tabular-nums text-gold">
                  {egp(o.total, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

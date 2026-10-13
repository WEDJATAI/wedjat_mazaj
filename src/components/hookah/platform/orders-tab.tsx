"use client";

/**
 * r61 — Platform Control Center · ORDERS explorer.
 *
 * Cross-venue shisha-order feed with venue/status/day filters and
 * cursor pagination. The platform sees the shisha corners' orders
 * (its own product) — never the venues' food & beverage checks.
 */

import * as React from "react";
import {
  ChevronDown,
  Clock,
  Loader2,
  RefreshCw,
  ShoppingBag,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { egp } from "@/lib/catalog";
import type { Lang } from "@/lib/i18n";
import { useI18n } from "@/store/i18n";
import { EmptyState, GoldButton, Kicker } from "../kit/kit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ExplorerOrder {
  id: string;
  customer: string | null;
  table: string | null;
  total: number;
  hookahs: number;
  status: string;
  source: string;
  revision: number;
  venue: { id: string; name: string; nameAr: string | null } | null;
  branch: { id: string; name: string; nameAr: string | null } | null;
  itemSummary: string;
  createdAt: string;
}

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  preparing: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  done: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
};

function fmtTime(iso: string, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

/* ------------------------------------------------------------------ */
/* OrdersTab                                                           */
/* ------------------------------------------------------------------ */

export function OrdersTab() {
  const { t, lang } = useI18n();
  const [orders, setOrders] = React.useState<ExplorerOrder[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [more, setMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // filters
  const [venueId, setVenueId] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [days, setDays] = React.useState(7);

  // venue list for the filter (from the orders' own venue data)
  const venues = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) if (o.venue) map.set(o.venue.id, o.venue.name);
    return [...map.entries()];
  }, [orders]);

  const fetchPage = React.useCallback(
    async (mode: "reset" | "more") => {
      const cur = mode === "more" ? cursor : null;
      if (mode === "reset") {
        setLoading(true);
        setError(null);
      } else {
        setMore(true);
      }
      try {
        const params = new URLSearchParams({
          days: String(days),
          limit: "25",
          ...(venueId !== "all" ? { venueId } : {}),
          ...(status !== "all" ? { status } : {}),
          ...(cur ? { cursor: cur } : {}),
        });
        const res = await fetch(`/api/platform/orders?${params.toString()}`);
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          orders?: ExplorerOrder[];
          nextCursor?: string | null;
        };
        if (!res.ok || !data.ok || !Array.isArray(data.orders)) {
          throw new Error(data.error ?? t("failed"));
        }
        setOrders((prev) => (mode === "more" ? [...prev, ...data.orders!] : data.orders!));
        setCursor(data.nextCursor ?? null);
      } catch (err) {
        if (mode === "reset") setError(err instanceof Error ? err.message : t("failed"));
        else toast.error(err instanceof Error ? err.message : t("failed"));
      } finally {
        setLoading(false);
        setMore(false);
      }
    },
    [days, venueId, status, cursor, t]
  );

  // reset-fetch whenever a filter changes
  React.useEffect(() => {
    void fetchPage("reset");
  }, [days, venueId, status]);

  React.useEffect(() => {
    const onRefresh = () => void fetchPage("reset");
    window.addEventListener("mazaj:platform-refresh", onRefresh);
    return () => window.removeEventListener("mazaj:platform-refresh", onRefresh);
  }, [fetchPage]);

  const pill = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-full px-3.5 text-[11px] font-semibold ring-1 ring-inset transition-colors",
      active
        ? "bg-primary/15 text-primary ring-primary/40"
        : "bg-white/[0.04] text-foreground/70 ring-white/[0.09] hover:text-foreground"
    );

  return (
    <section>
      <div className="mb-4">
        <Kicker className="justify-start">{t("pccOrdersTitle")}</Kicker>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("pccOrdersDesc")}</p>
      </div>

      {/* filter rows */}
      <div className="mb-3 space-y-2">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto" role="group" aria-label={t("pccFilterVenue")}>
          <button type="button" className={pill(venueId === "all")} onClick={() => setVenueId("all")}>
            {t("pccAllVenues")}
          </button>
          {venues.map(([id, name]) => (
            <button key={id} type="button" className={pill(venueId === id)} onClick={() => setVenueId(id)}>
              {name}
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto" role="group" aria-label={t("pccFilterStatus")}>
          {(["all", "pending", "preparing", "done"] as const).map((s) => (
            <button key={s} type="button" className={pill(status === s)} onClick={() => setStatus(s)}>
              {s === "all"
                ? t("pccAllStatuses")
                : s === "pending"
                  ? t("pending")
                  : s === "preparing"
                    ? t("stepPreparing")
                    : t("done")}
            </button>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-white/10" aria-hidden />
          {([1, 7, 30] as const).map((d) => (
            <button key={d} type="button" className={pill(days === d)} onClick={() => setDays(d)}>
              {t("pccDays", { count: d })}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<WifiOff className="size-6" />}
          title={t("failed")}
          description={error}
          action={
            <GoldButton size="sm" className="h-11" onClick={() => void fetchPage("reset")}>
              <RefreshCw className="size-3.5" aria-hidden />
              {t("retry")}
            </GoldButton>
          }
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-6" />}
          title={t("pccNoOrders")}
          description={t("pccNoOrdersDesc")}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="glass rounded-2xl px-4 py-3 transition-colors hover:border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground/90">
                      {o.customer ?? t("walkIn")} · {o.hookahs} {t("pccHookahsShort")}
                      {o.table ? ` · ${o.table}` : ""}
                      {o.revision > 0 && (
                        <span className="ms-1.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 ring-1 ring-inset ring-amber-500/30">
                          Rev {o.revision}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                      <Clock className="size-3 shrink-0" aria-hidden />
                      {fmtTime(o.createdAt, lang)} · {o.venue?.name ?? t("pccUnassigned")}
                      {o.branch ? ` · ${o.branch.name}` : ""} · {o.itemSummary}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-display text-sm font-bold tabular-nums text-gold">
                      {egp(o.total, lang)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ring-inset",
                        STATUS_CLS[o.status] ?? "bg-white/[0.05] text-foreground/70 ring-white/[0.1]"
                      )}
                    >
                      {o.status === "pending"
                        ? t("pending")
                        : o.status === "preparing"
                          ? t("stepPreparing")
                          : t("done")}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {cursor && (
            <button
              type="button"
              onClick={() => void fetchPage("more")}
              disabled={more}
              className="glass mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-foreground/85 ring-1 ring-inset ring-white/[0.09] transition-colors hover:border-primary/35 hover:text-primary disabled:opacity-50"
            >
              {more ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ChevronDown className="size-4" aria-hidden />
              )}
              {t("pccLoadMore")}
            </button>
          )}
        </>
      )}
    </section>
  );
}

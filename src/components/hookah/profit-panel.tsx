"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  LogOut,
  Wallet,
  Receipt,
  Coins,
  Percent,
  Package,
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

interface ProfitSummary {
  orderCount: number;
  hookahCount: number;
  totalRevenue: number;
  totalCogs: number;
  totalMolassesCost: number;
  totalSuppliesCost: number;
  netProfit: number;
  marginPct: number;
  totalSpent: number;
  formatted: {
    totalRevenue: string;
    totalCogs: string;
    netProfit: string;
    marginPct: string;
    totalSpent: string;
  };
}

interface BrandStat {
  brandId: string;
  brandName: string;
  emoji: string;
  revenue: number;
  cogs: number;
  netProfit: number;
  marginPct: number;
  hookahs: number;
}

interface RecentOrder {
  id: string;
  customerName: string | null;
  table: string | null;
  total: number;
  cogs: number;
  netProfit: number;
  marginPct: number;
  itemCount: number;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProfitPanel({ onSignOut }: { onSignOut: () => void }) {
  const [summary, setSummary] = React.useState<ProfitSummary | null>(null);
  const [brands, setBrands] = React.useState<BrandStat[]>([]);
  const [recent, setRecent] = React.useState<RecentOrder[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profit");
      const data = await res.json();
      if (data.ok) {
        setSummary(data.summary);
        setBrands(data.brandBreakdown);
        setRecent(data.recentOrders);
      } else {
        // toast handled below
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

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
              <TrendingUp className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="font-display truncate text-xl font-bold tracking-tight text-gold-soft">
                Profit
              </h1>
              <p className="-mt-0.5 truncate text-[11px] text-muted-foreground">
                Revenue, costs &amp; net margin
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
                aria-label="Sign out"
                className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-all hover:text-foreground active:scale-95"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
          <div className="ember-hairline mx-auto w-full max-w-5xl" aria-hidden />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-44 pt-6 sm:px-5">
          {loading || !summary ? (
            <div className="space-y-4">
              <Skeleton className="h-32 rounded-2xl bg-white/[0.05]" />
              <Skeleton className="h-24 rounded-2xl bg-white/[0.05]" />
              <Skeleton className="h-48 rounded-2xl bg-white/[0.05]" />
            </div>
          ) : (
            <>
              {/* Top metrics */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  icon={<Wallet className="size-4" />}
                  text={summary.formatted.totalRevenue}
                  label={
                    <>
                      Revenue
                      <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                        {summary.orderCount} orders · {summary.hookahCount} hookahs
                      </span>
                    </>
                  }
                />
                <StatTile
                  icon={<Receipt className="size-4 text-amber-400" />}
                  text={summary.formatted.totalCogs}
                  label={
                    <>
                      COGS
                      <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                        Molasses {egp(summary.totalMolassesCost)} + Supplies{" "}
                        {egp(summary.totalSuppliesCost)}
                      </span>
                    </>
                  }
                />
                <StatTile
                  className="ring-1 ring-primary/25"
                  icon={<Coins className="size-4" />}
                  text={summary.formatted.netProfit}
                  label={
                    <>
                      Net profit
                      <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                        after COGS
                      </span>
                    </>
                  }
                />
                <StatTile
                  icon={<Percent className="size-4" />}
                  text={summary.formatted.marginPct}
                  label={
                    <>
                      Margin
                      <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                        net / revenue
                      </span>
                    </>
                  }
                />
              </div>

              {/* Purchasing spend */}
              <div className="glass relative mt-4 flex items-center justify-between overflow-hidden rounded-2xl p-4">
                <div
                  className="pointer-events-none absolute -top-8 end-0 size-28 rounded-full bg-amber-500/10 blur-3xl"
                  aria-hidden
                />
                <div className="relative flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25">
                    <Package className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Procurement spend</p>
                    <p className="text-xs text-muted-foreground">
                      Total spent buying stock
                    </p>
                  </div>
                </div>
                <p className="font-display relative text-xl font-bold tabular-nums text-gold">
                  {summary.formatted.totalSpent}
                </p>
              </div>

              {/* Per-brand profit */}
              <section className="mt-8">
                <Kicker className="mb-4">Profit by brand</Kicker>
                {brands.length === 0 ? (
                  <EmptyState
                    className="py-8"
                    title="No orders yet"
                    description="Profit by brand appears once orders are placed."
                  />
                ) : (
                  <Stagger className="grid gap-3 sm:grid-cols-2">
                    {brands.map((b) => (
                      <StaggerItem key={b.brandId} className="h-full">
                        <div className="glass relative flex h-full flex-col rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lg ring-1 ring-white/[0.08]">
                                {b.emoji}
                              </span>
                              <div>
                                <p className="font-semibold">{b.brandName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {b.hookahs} hookahs sold
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "shrink-0 rounded-full ring-1",
                                b.marginPct >= 80
                                  ? "border border-primary/30 bg-primary/10 text-primary ring-primary/20"
                                  : b.marginPct >= 50
                                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-400 ring-amber-500/20"
                                  : "border border-destructive/30 bg-destructive/10 text-destructive ring-destructive/25"
                              )}
                            >
                              {b.marginPct}%
                            </Badge>
                          </div>
                          <div className="ember-hairline my-3" aria-hidden />
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Revenue</span>
                            <span className="font-display font-semibold tabular-nums text-gold-soft">
                              {egp(b.revenue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Cost</span>
                            <span className="font-medium tabular-nums text-amber-400">
                              −{egp(b.cogs)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between border-t border-white/[0.06] pt-2">
                            <span className="text-sm font-semibold">Net profit</span>
                            <span
                              className={cn(
                                "flex items-center gap-1 font-display text-lg font-bold tabular-nums",
                                b.netProfit >= 0 ? "text-gold" : "text-destructive"
                              )}
                            >
                              {b.netProfit >= 0 ? (
                                <TrendingUp className="size-4" />
                              ) : (
                                <TrendingDown className="size-4" />
                              )}
                              {egp(b.netProfit)}
                            </span>
                          </div>
                        </div>
                      </StaggerItem>
                    ))}
                  </Stagger>
                )}
              </section>

              {/* Recent orders with profit */}
              <section className="mt-8">
                <Kicker className="mb-4">Recent orders</Kicker>
                {recent.length === 0 ? (
                  <EmptyState className="py-8" title="No orders yet" />
                ) : (
                  <Stagger className="space-y-2">
                    {recent.slice(0, 10).map((o) => (
                      <StaggerItem key={o.id}>
                        <div className="glass flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.7)]">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {o.customerName || "Walk-in"}
                              {o.table ? ` · ${o.table}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {o.itemCount} hookahs · {timeAgo(o.createdAt)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-display text-sm font-semibold tabular-nums text-gold">
                              {egp(o.total)}
                            </p>
                            <p className="text-xs tabular-nums text-amber-400">
                              cost {egp(o.cogs)}
                            </p>
                            <p
                              className={cn(
                                "text-xs font-medium tabular-nums",
                                o.netProfit >= 0
                                  ? "text-gold-soft"
                                  : "text-destructive"
                              )}
                            >
                              +{egp(o.netProfit)} ({o.marginPct}%)
                            </p>
                          </div>
                        </div>
                      </StaggerItem>
                    ))}
                  </Stagger>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

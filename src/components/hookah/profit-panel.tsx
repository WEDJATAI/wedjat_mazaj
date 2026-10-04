"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <TrendingUp className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">
                Profit
              </p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                Revenue, costs & net margin
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
          {loading || !summary ? (
            <div className="space-y-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Top metrics */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard
                  icon={<Wallet className="size-4" />}
                  label="Revenue"
                  value={summary.formatted.totalRevenue}
                  sub={`${summary.orderCount} orders · ${summary.hookahCount} hookahs`}
                />
                <MetricCard
                  icon={<Receipt className="size-4" />}
                  label="COGS"
                  value={summary.formatted.totalCogs}
                  sub={`Molasses ${egp(summary.totalMolassesCost)} + Supplies ${egp(
                    summary.totalSuppliesCost
                  )}`}
                  negative
                />
                <MetricCard
                  icon={<Coins className="size-4" />}
                  label="Net profit"
                  value={summary.formatted.netProfit}
                  accent
                />
                <MetricCard
                  icon={<Percent className="size-4" />}
                  label="Margin"
                  value={summary.formatted.marginPct}
                  sub="net / revenue"
                />
              </div>

              {/* Purchasing spend */}
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
                    <Package className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Procurement spend</p>
                    <p className="text-xs text-muted-foreground">
                      Total spent buying stock
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold text-amber-500">
                  {summary.formatted.totalSpent}
                </p>
              </div>

              {/* Per-brand profit */}
              <section className="mt-6">
                <h2 className="mb-3 text-lg font-bold tracking-tight">
                  Profit by brand
                </h2>
                {brands.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    No orders yet. Profit by brand appears once orders are placed.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {brands.map((b) => (
                      <div
                        key={b.brandId}
                        className="rounded-2xl border border-border bg-card p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{b.emoji}</span>
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
                              b.marginPct >= 80
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                                : b.marginPct >= 50
                                ? "border border-primary/30 bg-primary/10 text-primary"
                                : "border border-amber-500/30 bg-amber-500/15 text-amber-500"
                            )}
                          >
                            {b.marginPct}%
                          </Badge>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="font-medium">{egp(b.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Cost</span>
                          <span className="text-amber-500">−{egp(b.cogs)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between border-t border-border pt-1">
                          <span className="text-sm font-semibold">Net profit</span>
                          <span
                            className={cn(
                              "flex items-center gap-1 text-lg font-bold",
                              b.netProfit >= 0 ? "text-emerald-500" : "text-destructive"
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
                    ))}
                  </div>
                )}
              </section>

              {/* Recent orders with profit */}
              <section className="mt-6">
                <h2 className="mb-3 text-lg font-bold tracking-tight">
                  Recent orders
                </h2>
                {recent.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    No orders yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {recent.slice(0, 10).map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {o.customerName || "Walk-in"}
                            {o.table ? ` · ${o.table}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {o.itemCount} hookahs · {timeAgo(o.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {egp(o.total)}
                          </p>
                          <p className="text-xs text-amber-500">
                            cost {egp(o.cogs)}
                          </p>
                          <p
                            className={cn(
                              "text-xs font-medium",
                              o.netProfit >= 0
                                ? "text-emerald-500"
                                : "text-destructive"
                            )}
                          >
                            +{egp(o.netProfit)} ({o.marginPct}%)
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  accent,
  negative,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/60 p-4",
        accent ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            accent
              ? "text-emerald-500"
              : negative
              ? "text-amber-500"
              : "text-primary"
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <p
        className={cn(
          "mt-1 text-xl font-bold",
          accent
            ? "text-emerald-500"
            : negative
            ? "text-amber-500"
            : "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

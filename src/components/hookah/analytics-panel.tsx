"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  RefreshCw,
  LogOut,
  Wallet,
  ShoppingBag,
  Star,
  Crown,
  Flame,
  Users,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { egp } from "@/lib/catalog";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface AnalyticsData {
  today: {
    revenue: number;
    orders: number;
    hookahs: number;
    profit: number;
  };
  last30: {
    orders: number;
    revenue: number;
    avgRating: number | null;
    ratedCount: number;
  };
  trend14: { day: string; revenue: number; orders: number }[];
  topBrands: {
    brandId: string;
    brandName: string;
    emoji: string;
    revenue: number;
    hookahs: number;
  }[];
  peakHours: { hour: number; orders: number }[];
  employees: { name: string; orders: number; revenue: number; hookahs: number }[];
  loyalty: { members: number; pointsOutstanding: number; newMembers30d: number };
  feedback: {
    id: string;
    customerName: string | null;
    table: string | null;
    rating: number;
    comment: string | null;
    ratedAt: string;
  }[];
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${h}:00`);

export function AnalyticsPanel({ onSignOut }: { onSignOut: () => void }) {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics");
      const json = await res.json();
      if (json.ok) setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Find peak hour for the highlight card
  const peakHour = data
    ? data.peakHours.reduce(
        (best, h) => (h.orders > best.orders ? h : best),
        data.peakHours[0] ?? { hour: 0, orders: 0 }
      )
    : null;

  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <BarChart3 className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">
                Analytics
              </p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                Trends, peaks, staff &amp; feedback
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
          {loading || !data ? (
            <div className="space-y-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Today KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi
                  icon={<Wallet className="size-4" />}
                  label="Today revenue"
                  value={egp(data.today.revenue)}
                  sub={`${data.today.orders} orders · ${data.today.hookahs} hookahs`}
                  accent
                />
                <Kpi
                  icon={<TrendingUp className="size-4" />}
                  label="Today profit"
                  value={egp(data.today.profit)}
                  sub="net of COGS"
                />
                <Kpi
                  icon={<Star className="size-4" />}
                  label="Avg rating"
                  value={
                    data.last30.avgRating != null
                      ? `${data.last30.avgRating} / 5`
                      : "—"
                  }
                  sub={`${data.last30.ratedCount} ratings · 30d`}
                />
                <Kpi
                  icon={<Crown className="size-4" />}
                  label="Mazaj+ members"
                  value={String(data.loyalty.members)}
                  sub={`+${data.loyalty.newMembers30d} this month`}
                />
              </div>

              {/* 14-day revenue trend */}
              <section className="mt-6">
                <h2 className="mb-3 text-lg font-bold tracking-tight">
                  Revenue — last 14 days
                </h2>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trend14}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(245,158,11,0.12)"
                        />
                        <XAxis
                          dataKey="day"
                          tickFormatter={(d: string) => d.slice(5)}
                          stroke="#a1a1aa"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#a1a1aa"
                          fontSize={11}
                          tickLine={false}
                          width={44}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#1c1917",
                            border: "1px solid #44403c",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(value: number | string) => [
                            egp(Number(value)),
                            "Revenue",
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-1 text-center text-[11px] text-muted-foreground">
                    30-day total: {egp(data.last30.revenue)} ·{" "}
                    {data.last30.orders} orders
                  </p>
                </div>
              </section>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {/* Top brands */}
                <section>
                  <h2 className="mb-3 text-lg font-bold tracking-tight">
                    Top brands · 30 days
                  </h2>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    {data.topBrands.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No orders yet.
                      </p>
                    ) : (
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={data.topBrands.slice(0, 7)}
                            layout="vertical"
                            margin={{ left: 8, right: 12 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis
                              type="category"
                              dataKey="brandName"
                              stroke="#a1a1aa"
                              fontSize={11}
                              width={78}
                              tickLine={false}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(245,158,11,0.06)" }}
                              contentStyle={{
                                background: "#1c1917",
                                border: "1px solid #44403c",
                                borderRadius: 12,
                                fontSize: 12,
                              }}
                              formatter={(value: number | string) => [
                                egp(Number(value)),
                                "Revenue",
                              ]}
                            />
                            <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                              {data.topBrands
                                .slice(0, 7)
                                .map((b, i) => (
                                  <Cell
                                    key={b.brandId}
                                    fill={
                                      ["#f59e0b", "#f43f5e", "#ef4444", "#eab308", "#f97316", "#dc2626", "#fbbf24"][i % 7]
                                    }
                                  />
                                ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </section>

                {/* Peak hours */}
                <section>
                  <h2 className="mb-3 text-lg font-bold tracking-tight">
                    Peak hours · 30 days
                  </h2>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.peakHours}>
                          <XAxis
                            dataKey="hour"
                            stroke="#a1a1aa"
                            fontSize={10}
                            tickLine={false}
                            interval={2}
                          />
                          <YAxis
                            stroke="#a1a1aa"
                            fontSize={11}
                            tickLine={false}
                            width={28}
                            allowDecimals={false}
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(245,158,11,0.06)" }}
                            contentStyle={{
                              background: "#1c1917",
                              border: "1px solid #44403c",
                              borderRadius: 12,
                              fontSize: 12,
                            }}
                            labelFormatter={(h: number) =>
                              `Around ${HOUR_LABELS[h]}`
                            }
                            formatter={(value: number | string) => [
                              value,
                              "Orders",
                            ]}
                          />
                          <Bar dataKey="orders" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {peakHour && peakHour.orders > 0 && (
                      <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                        <Flame className="size-3 text-primary" /> Busiest around{" "}
                        <b className="text-foreground">
                          {HOUR_LABELS[peakHour.hour]}
                        </b>{" "}
                        ({peakHour.orders} orders)
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {/* Employee leaderboard */}
              <section className="mt-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
                  <Users className="size-5 text-primary" /> Staff leaderboard ·
                  30 days
                </h2>
                {data.employees.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    No attributed orders yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {data.employees.map((e, i) => (
                      <li
                        key={e.name}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                      >
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                            i === 0
                              ? "bg-yellow-500/15 text-yellow-500"
                              : i === 1
                              ? "bg-slate-400/15 text-slate-300"
                              : i === 2
                              ? "bg-amber-700/15 text-amber-600"
                              : "bg-muted/60 text-muted-foreground"
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{e.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.orders} orders · {e.hookahs} hookahs
                          </p>
                        </div>
                        <p className="font-bold text-primary">{egp(e.revenue)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Guest feedback */}
              <section className="mt-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
                  <Star className="size-5 text-yellow-400" /> Guest feedback
                </h2>
                {data.feedback.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    No ratings yet — guests can rate from the live tracking
                    view once served.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {data.feedback.map((f) => (
                      <li
                        key={f.id}
                        className={cn(
                          "rounded-2xl border bg-card p-3",
                          f.rating <= 2
                            ? "border-destructive/40"
                            : "border-border"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {f.customerName || "Guest"}
                            {f.table ? ` · ${f.table}` : ""}
                          </p>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={cn(
                                  "size-3.5",
                                  n <= f.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        {f.comment && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            “{f.comment}”
                          </p>
                        )}
                        {f.rating <= 2 && (
                          <Badge className="mt-2 border border-destructive/40 bg-destructive/10 text-destructive">
                            Follow up recommended
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator className="mt-8" />
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                <ShoppingBag className="mr-1 inline size-3" />
                All figures from the last 30 days of live order data.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/60 p-4",
        accent ? "border-primary/40 bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={accent ? "text-primary" : "text-muted-foreground"}>
          {icon}
        </span>
        {label}
      </div>
      <p
        className={cn(
          "mt-1 text-xl font-bold",
          accent ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

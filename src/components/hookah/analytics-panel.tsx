"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  RefreshCw,
  LogOut,
  Wallet,
  ShoppingBag,
  Star,
  Crown,
  Flame,
  TrendingUp,
  Wand2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { egp, getBrand } from "@/lib/catalog";
import { BrandMark } from "./brand-mark";
import { useI18n } from "@/store/i18n";
import {
  EmptyState,
  GoldButton,
  Kicker,
  Stagger,
  StaggerItem,
  StatTile,
} from "./kit/kit";
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

/** Custom recharts tick — brand logo chip + name for the top-brands axis. */
function BrandTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const brand = getBrand(payload?.value ?? "");
  if (!brand) return null;
  return (
    <foreignObject
      x={Math.max(0, Number(x ?? 0) - 82)}
      y={Number(y ?? 0) - 11}
      width={82}
      height={22}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          color: "#d6d3d1",
          justifyContent: "flex-end",
          paddingRight: 6,
          lineHeight: "22px",
        }}
      >
        <span style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden" }}>
          {brand.name}
        </span>
        <BrandMark brandId={brand.id} size="xs" noRing />
      </div>
    </foreignObject>
  );
}

export function AnalyticsPanel({ onSignOut }: { onSignOut: () => void }) {
  const t = useI18n((s) => s.t);
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  // AI executive brief (LLM with deterministic fallback server-side)
  const [brief, setBrief] = React.useState<string | null>(null);
  const [briefLoading, setBriefLoading] = React.useState(false);
  const [briefSource, setBriefSource] = React.useState<"ai" | "engine">("engine");

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/analytics");
      const json = await res.json();
      if (json.ok) setData(json);
      else setLoadError(true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const generateBrief = async () => {
    if (briefLoading) return;
    setBriefLoading(true);
    try {
      const res = await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.ok) {
        setBrief(json.brief);
        setBriefSource(json.source);
      }
    } catch {
      // keep any previous brief
    } finally {
      setBriefLoading(false);
    }
  };

  // Find peak hour for the highlight card
  const peakHour = data
    ? data.peakHours.reduce(
        (best, h) => (h.orders > best.orders ? h : best),
        data.peakHours[0] ?? { hour: 0, orders: 0 }
      )
    : null;

  return (
    <div className="dark relative flex min-h-screen flex-col text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[oklch(0.155_0.014_60/0.72)] backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <BarChart3 className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="font-display truncate text-xl font-bold tracking-tight text-gold-soft">
                Analytics
              </h1>
              <p className="-mt-0.5 truncate text-[11px] text-muted-foreground">
                Trends, peaks, staff &amp; feedback
              </p>
            </div>
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={generateBrief}
                disabled={briefLoading}
                className="glass inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-xs font-medium text-primary transition-all hover:border-primary/50 active:scale-95 disabled:pointer-events-none disabled:opacity-60"
              >
                {briefLoading ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                <span className="hidden sm:inline">{t("aiBrief")}</span>
              </button>
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
          {!loading && loadError && !data ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-8 text-center">
              <AlertTriangle className="size-8 text-destructive" />
              <p className="text-sm font-medium">{t("analyticsLoadError")}</p>
              <GoldButton onClick={load}>
                <RefreshCw className="size-4" /> {t("tryAgain")}
              </GoldButton>
            </div>
          ) : loading || !data ? (
            <div className="space-y-4">
              <Skeleton className="h-28 rounded-2xl bg-white/[0.05]" />
              <Skeleton className="h-64 rounded-2xl bg-white/[0.05]" />
              <Skeleton className="h-48 rounded-2xl bg-white/[0.05]" />
            </div>
          ) : (
            <>
              {/* AI executive brief */}
              {brief && (
                <section className="glass relative mb-8 overflow-hidden rounded-2xl ring-1 ring-primary/25">
                  <div
                    className="pointer-events-none absolute -top-12 end-0 size-40 rounded-full bg-primary/10 blur-3xl"
                    aria-hidden
                  />
                  <div className="relative flex items-center gap-2 border-b border-white/[0.06] bg-primary/[0.08] px-4 py-2.5">
                    <Wand2 className="size-4 text-primary" />
                    <p className="text-sm font-bold text-primary">
                      {t("briefTitle")}
                    </p>
                    {briefSource === "ai" && (
                      <span className="ms-auto rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {t("aiBadge")}
                      </span>
                    )}
                  </div>
                  <div className="relative space-y-1.5 px-4 py-3">
                    {brief.split("\n").map((line, i) =>
                      line.trim() ? (
                        <p
                          key={i}
                          className="text-sm leading-relaxed text-foreground/90"
                        >
                          {line.replace(/^[-•*]\s*/, "")}
                        </p>
                      ) : null
                    )}
                  </div>
                </section>
              )}

              {/* Today KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  className="ring-1 ring-primary/25"
                  icon={<Wallet className="size-4" />}
                  text={egp(data.today.revenue)}
                  label={
                    <>
                      Today revenue
                      <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                        {data.today.orders} orders · {data.today.hookahs} hookahs
                      </span>
                    </>
                  }
                />
                <StatTile
                  icon={<TrendingUp className="size-4" />}
                  text={egp(data.today.profit)}
                  label={
                    <>
                      Today profit
                      <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                        net of COGS
                      </span>
                    </>
                  }
                />
                <StatTile
                  icon={<Star className="size-4" />}
                  text={
                    data.last30.avgRating != null
                      ? `${data.last30.avgRating} / 5`
                      : "—"
                  }
                  label={
                    <>
                      Avg rating
                      <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                        {data.last30.ratedCount} ratings · 30d
                      </span>
                    </>
                  }
                />
                <StatTile
                  icon={<Crown className="size-4" />}
                  text={String(data.loyalty.members)}
                  label={
                    <>
                      Mazaj+ members
                      <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground/80">
                        +{data.loyalty.newMembers30d} this month
                      </span>
                    </>
                  }
                />
              </div>

              {/* 14-day revenue trend */}
              <section className="mt-8">
                <Kicker className="mb-4">Revenue — last 14 days</Kicker>
                <div className="glass relative overflow-hidden rounded-2xl p-4">
                  <div
                    className="pointer-events-none absolute -top-10 end-0 size-32 rounded-full bg-primary/10 blur-3xl"
                    aria-hidden
                  />
                  <div className="relative h-56">
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
                          cursor={{ stroke: "rgba(245,158,11,0.3)" }}
                          contentStyle={{
                            background: "#1c1917",
                            border: "1px solid rgba(245,158,11,0.25)",
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
                          activeDot={{ r: 4, fill: "#fbbf24" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="relative mt-1 text-center text-[11px] text-muted-foreground">
                    30-day total: {egp(data.last30.revenue)} ·{" "}
                    {data.last30.orders} orders
                  </p>
                </div>
              </section>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                {/* Top brands */}
                <section>
                  <Kicker className="mb-4">Top brands · 30 days</Kicker>
                  <div className="glass relative overflow-hidden rounded-2xl p-4">
                    <div
                      className="pointer-events-none absolute -top-10 end-0 size-32 rounded-full bg-primary/10 blur-3xl"
                      aria-hidden
                    />
                    {data.topBrands.length === 0 ? (
                      <p className="relative py-8 text-center text-sm text-muted-foreground">
                        No orders yet.
                      </p>
                    ) : (
                      <div className="relative h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={data.topBrands.slice(0, 7)}
                            layout="vertical"
                            margin={{ left: 8, right: 12 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis
                              type="category"
                              dataKey="brandId"
                              width={88}
                              tickLine={false}
                              axisLine={false}
                              tick={<BrandTick />}
                              interval={0}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(245,158,11,0.06)" }}
                              contentStyle={{
                                background: "#1c1917",
                                border: "1px solid rgba(245,158,11,0.25)",
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
                  <Kicker className="mb-4">Peak hours · 30 days</Kicker>
                  <div className="glass relative overflow-hidden rounded-2xl p-4">
                    <div
                      className="pointer-events-none absolute -top-10 end-0 size-32 rounded-full bg-primary/10 blur-3xl"
                      aria-hidden
                    />
                    <div className="relative h-52">
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
                              border: "1px solid rgba(245,158,11,0.25)",
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
                      <p className="relative mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                        <Flame className="size-3 text-primary" /> Busiest around{" "}
                        <b className="font-semibold text-foreground">
                          {HOUR_LABELS[peakHour.hour]}
                        </b>{" "}
                        ({peakHour.orders} orders)
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {/* Employee leaderboard */}
              <section className="mt-8">
                <Kicker className="mb-4">Staff leaderboard · 30 days</Kicker>
                {data.employees.length === 0 ? (
                  <EmptyState
                    className="py-8"
                    title="No attributed orders yet"
                  />
                ) : (
                  <Stagger className="space-y-2">
                    {data.employees.map((e, i) => (
                      <StaggerItem key={e.name}>
                        <div className="glass flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.7)]">
                          <span
                            className={cn(
                              "font-display grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums",
                              i === 0
                                ? "bg-primary/15 text-primary ring-1 ring-primary/25"
                                : i === 1
                                ? "bg-white/[0.08] text-foreground/80"
                                : i === 2
                                ? "bg-amber-700/20 text-amber-500 ring-1 ring-amber-700/20"
                                : "bg-white/[0.04] text-muted-foreground"
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
                          <p className="font-display font-bold tabular-nums text-gold">
                            {egp(e.revenue)}
                          </p>
                        </div>
                      </StaggerItem>
                    ))}
                  </Stagger>
                )}
              </section>

              {/* Guest feedback */}
              <section className="mt-8">
                <Kicker className="mb-4">Guest feedback</Kicker>
                {data.feedback.length === 0 ? (
                  <EmptyState
                    className="py-8"
                    title="No ratings yet"
                    description="Guests can rate from the live tracking view once served."
                  />
                ) : (
                  <Stagger className="space-y-2">
                    {data.feedback.map((f) => (
                      <StaggerItem key={f.id}>
                        <div
                          className={cn(
                            "glass rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.7)]",
                            f.rating <= 2 && "ring-1 ring-destructive/40"
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
                            <Badge
                              variant="destructive"
                              className="mt-2 rounded-full border border-destructive/40 bg-destructive/10"
                            >
                              Follow up recommended
                            </Badge>
                          )}
                        </div>
                      </StaggerItem>
                    ))}
                  </Stagger>
                )}
              </section>

              <div className="ember-hairline mt-8" aria-hidden />
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

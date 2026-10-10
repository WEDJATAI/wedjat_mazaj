"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useReducedMotion } from "framer-motion";
import {
  RefreshCw,
  LogOut,
  Cloud,
  CloudOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AppHeader,
  EmptyState,
  Kicker,
  ScreenShell,
  Stagger,
  StaggerItem,
} from "./kit/kit";

interface HealthInfo {
  connected: boolean;
  tableCount: number;
  productCount: number;
  latencyMs: number;
}

interface SyncedOrder {
  id: string;
  customerName: string | null;
  table: string | null;
  total: number;
  wedjatOrderId: number | null;
  wedjatSyncStatus: string;
  wedjatRevokedBy: string | null;
  wedjatRevokedAt: string | null;
  createdAt: string;
}

export function SyncPanel({ onSignOut }: { onSignOut: () => void }) {
  const [health, setHealth] = React.useState<HealthInfo | null>(null);
  const [orders, setOrders] = React.useState<SyncedOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncingRevocations, setSyncingRevocations] = React.useState(false);
  const [syncingPrices, setSyncingPrices] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, oRes] = await Promise.all([
        fetch("/api/wedjat/health"),
        fetch("/api/orders?take=30"),
      ]);
      const hData = await hRes.json();
      const oData = await oRes.json();
      if (hData.ok || hData.connected !== undefined) {
        setHealth({
          connected: hData.connected,
          tableCount: hData.tableCount ?? 0,
          productCount: hData.productCount ?? 0,
          latencyMs: hData.latencyMs ?? 0,
        });
      }
      if (oData.ok) {
        setOrders(
          oData.orders.filter((o: SyncedOrder) => o.wedjatSyncStatus !== "pending" || o.table)
        );
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    // Poll for revocations every 30s
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/wedjat/sync-revocations");
        const data = await res.json();
        if (data.ok && data.updated > 0) {
          toast.warning(`${data.updated} order(s) revoked in Wedjat RSM`, {
            description: "Check the revoked list below.",
          });
          load();
        }
      } catch {
        // silent
      }
    }, 30000);
    return () => clearInterval(id);
  }, [load]);

  const syncRevocations = async () => {
    setSyncingRevocations(true);
    try {
      const res = await fetch("/api/wedjat/sync-revocations");
      const data = await res.json();
      if (data.ok) {
        toast.success(
          `Checked ${data.checked} orders, ${data.updated} revoked`
        );
        load();
      }
    } catch {
      toast.error("Could not sync revocations");
    } finally {
      setSyncingRevocations(false);
    }
  };

  const syncPrices = async () => {
    setSyncingPrices(true);
    try {
      const res = await fetch("/api/wedjat/sync-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Prices synced to Wedjat`, {
          description: `${data.synced}/${data.total} products updated`,
        });
      }
    } catch {
      toast.error("Could not sync prices");
    } finally {
      setSyncingPrices(false);
    }
  };

  const revoked = orders.filter((o) => o.wedjatSyncStatus === "revoked");
  const synced = orders.filter((o) => o.wedjatSyncStatus === "synced");
  const failed = orders.filter((o) => o.wedjatSyncStatus === "failed");

  return (
    <ScreenShell className="min-h-screen">
      <AppHeader
        icon={<Database className="size-5" />}
        title="Wedjat RSM Sync"
        subtitle="Connection health & order sync status"
        actions={
          <>
            <button
              type="button"
              onClick={load}
              aria-label="Refresh"
              className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              className="glass grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-44 pt-6 sm:px-5">
        {/* Connection health */}
        <section className="mb-6">
          <h2 className="sr-only">Connection</h2>
          <Kicker className="mb-3 justify-start">Connection</Kicker>
          {loading ? (
            <Skeleton className="h-28 rounded-2xl bg-white/[0.05]" />
          ) : (
            <div
              className={cn(
                "glass relative flex items-center gap-4 overflow-hidden rounded-2xl p-4",
                health?.connected
                  ? "ring-1 ring-emerald-500/25"
                  : "ring-1 ring-destructive/30"
              )}
            >
              <div
                className="pointer-events-none absolute -end-10 -top-14 size-36 rounded-full bg-primary/10 opacity-50 blur-3xl"
                aria-hidden
              />
              <SyncOrb
                spinning={!!health?.connected}
                connected={!!health?.connected}
              />
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold tracking-tight text-gold-soft">
                  {health?.connected ? "Connected to Wedjat RSM" : "Disconnected"}
                </p>
                {health?.connected && (
                  <p className="text-xs text-muted-foreground">
                    {health.tableCount} tables · {health.productCount} products ·{" "}
                    <span className="font-display font-semibold tabular-nums text-gold-soft">
                      {health.latencyMs}ms
                    </span>{" "}
                    latency
                  </p>
                )}
              </div>
              {health?.connected ? (
                <CheckCircle2 className="size-6 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="size-6 shrink-0 text-destructive" />
              )}
            </div>
          )}
        </section>

        {/* Action buttons */}
        <Stagger className="mb-6 grid gap-3 sm:grid-cols-2">
          <StaggerItem>
            <button
              onClick={syncRevocations}
              disabled={syncingRevocations}
              className="glass group flex h-full w-full items-center gap-3 rounded-2xl p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)] disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/20">
                <AlertTriangle className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Check revocations</span>
                <span className="block text-xs text-muted-foreground">
                  Poll Wedjat for cancelled orders
                </span>
              </span>
              {syncingRevocations && (
                <RefreshCw className="size-4 shrink-0 animate-spin text-muted-foreground" />
              )}
            </button>
          </StaggerItem>
          <StaggerItem>
            <button
              onClick={syncPrices}
              disabled={syncingPrices}
              className="glass group flex h-full w-full items-center gap-3 rounded-2xl p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)] disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                <TrendingUp className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Sync prices →</span>
                <span className="block text-xs text-muted-foreground">
                  Push Mazaj prices to Wedjat
                </span>
              </span>
              {syncingPrices && (
                <RefreshCw className="size-4 shrink-0 animate-spin text-muted-foreground" />
              )}
            </button>
          </StaggerItem>
        </Stagger>

        {/* Summary stats */}
        <section className="mb-6 grid grid-cols-3 gap-3">
          <StatCard label="Synced" value={String(synced.length)} color="emerald" />
          <StatCard label="Revoked" value={String(revoked.length)} color="amber" />
          <StatCard label="Failed" value={String(failed.length)} color="red" />
        </section>

        {/* Revoked orders (with Wedjat employee attribution) */}
        {revoked.length > 0 && (
          <section className="mb-6">
            <h2 className="sr-only">Revoked by Wedjat RSM</h2>
            <Kicker className="mb-3 justify-start">Revoked by Wedjat RSM</Kicker>
            <Stagger className="space-y-2">
              {revoked.map((o) => (
                <StaggerItem key={o.id}>
                  <div className="glass flex items-center gap-3 rounded-2xl p-3 ring-1 ring-amber-500/25">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
                      <XCircle className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {o.customerName || "Walk-in"} · {o.table}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Revoked by{" "}
                        <span className="font-medium text-amber-500">
                          {o.wedjatRevokedBy || "Unknown"}
                        </span>{" "}
                        from Wedjat RSM
                        {o.wedjatRevokedAt &&
                          ` · ${new Date(o.wedjatRevokedAt).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-display text-sm font-bold tabular-nums text-muted-foreground line-through">
                        {o.total} EGP
                      </p>
                      <Badge variant="secondary" className="mt-0.5 bg-amber-500/15 text-amber-500">
                        Revoked
                      </Badge>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        )}

        {/* Synced orders */}
        <section>
          <h2 className="sr-only">Synced orders</h2>
          <Kicker className="mb-3 justify-start">Synced orders</Kicker>
          {synced.length === 0 ? (
            <EmptyState
              icon={<Database className="size-6" />}
              title="No synced orders yet"
              description="Orders with a table number sync to Wedjat RSM automatically."
            />
          ) : (
            <Stagger className="space-y-2">
              {synced.slice(0, 15).map((o) => (
                <StaggerItem key={o.id}>
                  <div className="glass flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:border-primary/30">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {o.customerName || "Walk-in"} · {o.table}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Wedjat #{o.wedjatOrderId} ·{" "}
                        {new Date(o.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-display text-sm font-bold tabular-nums text-gold-soft">
                        {o.total} EGP
                      </p>
                      <Badge variant="secondary" className="mt-0.5 bg-emerald-500/10 text-emerald-500">
                        <ArrowUpRight className="ms-0.5 size-3" /> Synced
                      </Badge>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>
      </main>
    </ScreenShell>
  );
}

/** Gold spinning arcs — the live sync heartbeat. */
function SyncOrb({
  spinning,
  connected,
}: {
  spinning: boolean;
  connected: boolean;
}) {
  const reduced = useReducedMotion();
  const spin = spinning && !reduced;
  return (
    <span
      className={cn(
        "relative grid size-12 shrink-0 place-items-center rounded-2xl ring-1",
        connected ? "bg-primary/15 ring-primary/25" : "bg-white/[0.04] ring-white/[0.08]"
      )}
      aria-hidden
    >
      <motion.span
        className="absolute inset-1.5"
        animate={spin ? { rotate: 360 } : { rotate: 0 }}
        transition={
          spin
            ? { repeat: Infinity, duration: 1.8, ease: "linear" }
            : { duration: 0.3 }
        }
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-full">
          <path
            d="M12 3a9 9 0 0 1 8.5 6"
            stroke="oklch(0.78 0.15 65)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </motion.span>
      <motion.span
        className="absolute inset-0.5"
        animate={spin ? { rotate: -360 } : { rotate: 0 }}
        transition={
          spin
            ? { repeat: Infinity, duration: 3, ease: "linear" }
            : { duration: 0.3 }
        }
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-full">
          <path
            d="M12 21a9 9 0 0 1-8.5-6"
            stroke="oklch(0.78 0.15 65)"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.45"
          />
        </svg>
      </motion.span>
      {connected ? (
        <Cloud className="relative size-4 text-primary" />
      ) : (
        <CloudOff className="relative size-4 text-muted-foreground" />
      )}
    </span>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "amber" | "red";
}) {
  const cls = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-destructive",
  }[color];
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("font-display mt-1 text-2xl font-bold tabular-nums", cls)}>
        {value}
      </p>
    </div>
  );
}

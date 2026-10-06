"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Database className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">
                Wedjat RSM Sync
              </p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                Connection health & order sync status
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
          {/* Connection health */}
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-bold tracking-tight">Connection</h2>
            {loading ? (
              <Skeleton className="h-28 rounded-2xl" />
            ) : (
              <div
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4",
                  health?.connected
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-destructive/40 bg-destructive/5"
                )}
              >
                <span
                  className={cn(
                    "grid size-12 place-items-center rounded-2xl",
                    health?.connected
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-destructive/15 text-destructive"
                  )}
                >
                  {health?.connected ? (
                    <Cloud className="size-6" />
                  ) : (
                    <CloudOff className="size-6" />
                  )}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">
                    {health?.connected ? "Connected to Wedjat RSM" : "Disconnected"}
                  </p>
                  {health?.connected && (
                    <p className="text-xs text-muted-foreground">
                      {health.tableCount} tables · {health.productCount} products ·{" "}
                      {health.latencyMs}ms latency
                    </p>
                  )}
                </div>
                {health?.connected ? (
                  <CheckCircle2 className="size-6 text-emerald-500" />
                ) : (
                  <XCircle className="size-6 text-destructive" />
                )}
              </div>
            )}
          </section>

          {/* Action buttons */}
          <section className="mb-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={syncRevocations}
              disabled={syncingRevocations}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/60 disabled:opacity-50"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
                <AlertTriangle className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-semibold">Check revocations</p>
                <p className="text-xs text-muted-foreground">
                  Poll Wedjat for cancelled orders
                </p>
              </div>
              {syncingRevocations && (
                <RefreshCw className="size-4 animate-spin text-muted-foreground" />
              )}
            </button>
            <button
              onClick={syncPrices}
              disabled={syncingPrices}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/60 disabled:opacity-50"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <TrendingUp className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-semibold">Sync prices →</p>
                <p className="text-xs text-muted-foreground">
                  Push Mazaj prices to Wedjat
                </p>
              </div>
              {syncingPrices && (
                <RefreshCw className="size-4 animate-spin text-muted-foreground" />
              )}
            </button>
          </section>

          {/* Summary stats */}
          <section className="mb-6 grid grid-cols-3 gap-3">
            <StatCard label="Synced" value={String(synced.length)} color="emerald" />
            <StatCard label="Revoked" value={String(revoked.length)} color="amber" />
            <StatCard label="Failed" value={String(failed.length)} color="red" />
          </section>

          {/* Revoked orders (with Wedjat employee attribution) */}
          {revoked.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-bold tracking-tight">
                Revoked by Wedjat RSM
              </h2>
              <div className="space-y-2">
                {revoked.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3"
                  >
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
                    <div className="text-right">
                      <p className="text-sm font-bold line-through text-muted-foreground">
                        {o.total} EGP
                      </p>
                      <Badge variant="secondary" className="bg-amber-500/15 text-amber-500">
                        Revoked
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Synced orders */}
          <section>
            <h2 className="mb-3 text-lg font-bold tracking-tight">
              Synced orders
            </h2>
            {synced.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No synced orders yet. Orders with a table number sync to Wedjat RSM automatically.
              </div>
            ) : (
              <div className="space-y-2">
                {synced.slice(0, 15).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
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
                    <div className="text-right">
                      <p className="text-sm font-semibold">{o.total} EGP</p>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
                        <ArrowUpRight className="mr-0.5 size-3" /> Synced
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
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
    emerald: "text-emerald-500 border-emerald-500/30",
    amber: "text-amber-500 border-amber-500/30",
    red: "text-destructive border-destructive/30",
  }[color];
  return (
    <div className={cn("rounded-2xl border bg-card/60 p-4", cls)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", cls)}>{value}</p>
    </div>
  );
}

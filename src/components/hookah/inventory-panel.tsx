"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Boxes,
  PackagePlus,
  AlertTriangle,
  RefreshCw,
  Flame,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BRANDS } from "@/lib/catalog";

interface InventoryRow {
  id: string;
  brandId: string;
  brandName: string;
  stockGrams: number;
  lowStockThreshold: number;
  updatedAt: string;
}

function hookahsFromGrams(g: number): number {
  return Math.floor(g / 20);
}

export function InventoryPanel({ onSignOut }: { onSignOut: () => void }) {
  const [rows, setRows] = React.useState<InventoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [restockBrand, setRestockBrand] = React.useState<InventoryRow | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (data.ok) {
        // merge with catalog so every brand shows even if seeded
        const byId = new Map(data.items.map((r: InventoryRow) => [r.brandId, r]));
        const merged = BRANDS.map(
          (b) =>
            byId.get(b.id) ?? {
              id: b.id,
              brandId: b.id,
              brandName: b.name,
              stockGrams: 0,
              lowStockThreshold: 120,
              updatedAt: new Date().toISOString(),
            }
        );
        setRows(merged as InventoryRow[]);
      } else {
        toast.error("Could not load inventory");
      }
    } catch {
      toast.error("Could not load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const lowCount = rows.filter(
    (r) => r.stockGrams <= r.lowStockThreshold
  ).length;

  return (
    <div className="dark relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Boxes className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">
                Inventory
              </p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                Molasses stock · auto-deducted on order
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {lowCount > 0 && (
                <Badge
                  variant="secondary"
                  className="gap-1 border border-amber-500/30 bg-amber-500/15 text-amber-500"
                >
                  <AlertTriangle className="size-3" /> {lowCount} low
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => load()}
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
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Brands tracked"
              value={String(rows.length)}
            />
            <StatCard
              label="Total molasses"
              value={`${Math.round(
                rows.reduce((s, r) => s + r.stockGrams, 0)
              )}g`}
            />
            <StatCard
              label="Total hookahs left"
              value={String(
                hookahsFromGrams(rows.reduce((s, r) => s + r.stockGrams, 0))
              )}
            />
            <StatCard
              label="Low stock"
              value={String(lowCount)}
              warn={lowCount > 0}
            />
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((r) => {
                const low = r.stockGrams <= r.lowStockThreshold;
                const brand = BRANDS.find((b) => b.id === r.brandId);
                const pct = Math.max(
                  4,
                  Math.min(100, (r.stockGrams / 1000) * 100)
                );
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-2xl border bg-card p-4",
                      low ? "border-amber-500/50" : "border-border"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid size-9 place-items-center rounded-xl bg-muted/60 text-lg">
                          {brand?.emoji ?? "📦"}
                        </span>
                        <div>
                          <p className="font-semibold">{r.brandName}</p>
                          <p className="text-xs text-muted-foreground">
                            {hookahsFromGrams(r.stockGrams)} hookahs left
                          </p>
                        </div>
                      </div>
                      {low ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 border border-amber-500/30 bg-amber-500/15 text-amber-500"
                        >
                          <AlertTriangle className="size-3" /> Low
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                        >
                          In stock
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {Math.round(r.stockGrams)}g
                        </span>
                        <span className="text-muted-foreground">
                          threshold {Math.round(r.lowStockThreshold)}g
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            low ? "bg-amber-500" : "bg-primary"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full rounded-xl"
                      onClick={() => setRestockBrand(r)}
                    >
                      <PackagePlus className="size-4" /> Restock
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <footer className="relative mt-auto border-t border-border bg-background/60 py-6">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-1.5 px-4 text-center text-xs text-muted-foreground">
            <Flame className="size-3 text-primary" />
            Inventory auto-deducts 20g per hookah on every order
          </div>
        </footer>
      </div>

      <RestockSheet
        row={restockBrand}
        open={!!restockBrand}
        onOpenChange={(o) => !o && setRestockBrand(null)}
        onDone={load}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold",
          warn ? "text-amber-500" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RestockSheet({
  row,
  open,
  onOpenChange,
  onDone,
}: {
  row: InventoryRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [grams, setGrams] = React.useState(500);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setGrams(500);
  }, [open]);

  if (!row) return null;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: row.brandId, addGrams: grams }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not restock");
      }
      toast.success(`Restocked ${row.brandName}`, {
        description: `+${grams}g`,
      });
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restock");
    } finally {
      setSaving(false);
    }
  };

  const presets = [100, 250, 500, 1000];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto w-full max-w-xl rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Restock {row.brandName}</SheetTitle>
          <SheetDescription>
            Current: {Math.round(row.stockGrams)}g · adds molasses to this brand.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-2">
          <Label className="mb-2 block text-xs font-medium text-muted-foreground">
            Amount (grams)
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <Button
                key={p}
                variant={grams === p ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setGrams(p)}
              >
                {p}g
              </Button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            value={grams}
            onChange={(e) => setGrams(Math.max(1, Number(e.target.value)))}
            className="mt-3"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            = {hookahsFromGrams(grams)} extra hookahs worth
          </p>
        </div>

        <SheetFooter>
          <Button
            className="w-full rounded-xl"
            size="lg"
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Saving…" : `Add ${grams}g`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

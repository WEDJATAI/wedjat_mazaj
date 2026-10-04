"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  ShoppingCart,
  RefreshCw,
  LogOut,
  Plus,
  Loader2,
  Package,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BRANDS, SUPPLIES, egp, type PackOption } from "@/lib/catalog";

interface PurchaseRow {
  id: string;
  kind: string;
  refId: string;
  name: string;
  gramsOrUnits: number;
  packCount: number;
  unitCost: number;
  totalCost: number;
  buyerName: string | null;
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

export function PurchasesPanel({ onSignOut }: { onSignOut: () => void }) {
  const [purchases, setPurchases] = React.useState<PurchaseRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [buyOpen, setBuyOpen] = React.useState(false);
  const [totalSpent, setTotalSpent] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchases");
      const data = await res.json();
      if (data.ok) {
        setPurchases(data.purchases);
        setTotalSpent(
          data.purchases.reduce((s: number, p: PurchaseRow) => s + p.totalCost, 0)
        );
      } else {
        toast.error("Could not load purchases");
      }
    } catch {
      toast.error("Could not load purchases");
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
              <ShoppingCart className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight smoke-text">
                Purchases
              </p>
              <p className="-mt-0.5 text-[11px] text-muted-foreground">
                Buy molasses packs & supplies
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => setBuyOpen(true)}
              >
                <Plus className="size-4" /> Buy
              </Button>
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
          {/* Summary card */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Total spent"
              value={egp(totalSpent)}
              accent
            />
            <StatCard
              label="Purchases"
              value={String(purchases.length)}
            />
            <StatCard
              label="Last purchase"
              value={
                purchases[0] ? timeAgo(purchases[0].createdAt) : "—"
              }
            />
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-muted/50">
                <ShoppingCart className="size-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No purchases yet</p>
                <p className="text-sm text-muted-foreground">
                  Tap “Buy” to purchase molasses packs or supplies.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {purchases.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Package className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.packCount} × {egp(p.unitCost)}/pack
                      {p.buyerName ? ` · by ${p.buyerName}` : ""} · {timeAgo(p.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{egp(p.totalCost)}</p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "mt-0.5",
                        p.kind === "molasses"
                          ? "border border-primary/30 bg-primary/10 text-primary"
                          : "border border-amber-500/30 bg-amber-500/15 text-amber-500"
                      )}
                    >
                      {p.kind}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>

      <BuySheet
        open={buyOpen}
        onOpenChange={setBuyOpen}
        onDone={load}
        buyerName="Admin"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold",
          accent ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function BuySheet({
  open,
  onOpenChange,
  onDone,
  buyerName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
  buyerName: string;
}) {
  const [tab, setTab] = React.useState<"molasses" | "supply">("molasses");
  const [selected, setSelected] = React.useState<{
    kind: "molasses" | "supply";
    refId: string;
    name: string;
    gramsOrUnits: number;
    unitCost: number;
  } | null>(null);
  const [packCount, setPackCount] = React.useState(1);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSelected(null);
      setPackCount(1);
      setTab("molasses");
    }
  }, [open]);

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: selected.kind,
          refId: selected.refId,
          gramsOrUnits: selected.gramsOrUnits,
          packCount,
          unitCost: selected.unitCost,
          buyerName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      toast.success("Purchase recorded", {
        description: `${selected.name} × ${packCount} = ${egp(
          selected.unitCost * packCount
        )}`,
      });
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record purchase");
    } finally {
      setSaving(false);
    }
  };

  const total = selected ? selected.unitCost * packCount : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-border p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" /> Buy stock
          </SheetTitle>
          <SheetDescription>
            Purchasing restocks inventory automatically and records the cost.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 pb-4">
          {/* tab switch */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Button
              variant={tab === "molasses" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => {
                setTab("molasses");
                setSelected(null);
              }}
            >
              Molasses packs
            </Button>
            <Button
              variant={tab === "supply" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => {
                setTab("supply");
                setSelected(null);
              }}
            >
              Supplies
            </Button>
          </div>

          {tab === "molasses" ? (
            <div className="slim-scroll max-h-[40vh] space-y-2 overflow-y-auto">
              {BRANDS.map((b) =>
                b.packs.map((pack: PackOption, i: number) => {
                  const key = `${b.id}:${pack.grams}:${i}`;
                  const isSelected =
                    selected?.refId === b.id &&
                    selected?.gramsOrUnits === pack.grams;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setSelected({
                          kind: "molasses",
                          refId: b.id,
                          name: `${b.name} · ${pack.label}`,
                          gramsOrUnits: pack.grams,
                          unitCost: pack.costEgp,
                        })
                      }
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      <span className="text-xl">{b.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {pack.label} · {pack.grams}g
                        </p>
                      </div>
                      <span className="font-semibold text-primary">
                        {egp(pack.costEgp)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {SUPPLIES.map((s) => {
                // supply "pack" = 100 units at cost × 100
                const packUnits = 100;
                const packCost = Math.round(s.cost * packUnits * 100) / 100;
                const isSelected =
                  selected?.refId === s.key &&
                  selected?.gramsOrUnits === packUnits;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() =>
                      setSelected({
                        kind: "supply",
                        refId: s.key,
                        name: `${s.name} · ${packUnits} ${s.unit}/pack`,
                        gramsOrUnits: packUnits,
                        unitCost: packCost,
                      })
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <span className="text-xl">{s.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {packUnits} {s.unit} · {egp(s.cost)}/{s.unit.replace(/s$/, "")}
                      </p>
                    </div>
                    <span className="font-semibold text-primary">
                      {egp(packCost)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <>
              <Separator className="my-4" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Selected
                  </Label>
                  <span className="text-sm font-medium">{selected.name}</span>
                </div>
                <div>
                  <Label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Quantity (packs)
                  </Label>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-card p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPackCount((q) => Math.max(1, q - 1))}
                      disabled={packCount <= 1}
                      aria-label="Decrease"
                    >
                      −
                    </Button>
                    <span className="min-w-12 text-center text-2xl font-bold tabular-nums">
                      {packCount}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPackCount((q) => Math.min(999, q + 1))}
                      aria-label="Increase"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <SheetFooter className="border-t border-border px-5 py-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total cost</span>
            <span className="text-lg font-bold">{egp(total)}</span>
          </div>
          <Button
            className="w-full rounded-xl"
            size="lg"
            disabled={!selected || saving}
            onClick={submit}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Buy & restock · ${egp(total)}`
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

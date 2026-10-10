"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  CalendarClock,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BRANDS, SUPPLIES, egp, type PackOption } from "@/lib/catalog";
import { BrandMark } from "./brand-mark";
import {
  EmptyState,
  GoldButton,
  Kicker,
  SheetGrip,
  Stagger,
  StaggerItem,
  StatTile,
} from "./kit/kit";

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
    <div className="dark relative flex min-h-screen flex-col text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[oklch(0.155_0.014_60/0.72)] backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <ShoppingCart className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="font-display truncate text-xl font-bold tracking-tight text-gold-soft">
                Purchases
              </h1>
              <p className="-mt-0.5 truncate text-[11px] text-muted-foreground">
                Buy molasses packs &amp; supplies
              </p>
            </div>
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <GoldButton
                size="sm"
                className="min-h-10"
                onClick={() => setBuyOpen(true)}
              >
                <Plus className="size-4" /> Buy
              </GoldButton>
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
          {/* Summary card */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              icon={<Coins className="size-4" />}
              text={egp(totalSpent)}
              label="Total spent"
            />
            <StatTile
              key={purchases.length}
              value={purchases.length}
              label="Purchases"
              icon={<ShoppingCart className="size-4" />}
            />
            <StatTile
              icon={<CalendarClock className="size-4" />}
              text={purchases[0] ? timeAgo(purchases[0].createdAt) : "—"}
              label="Last purchase"
            />
          </div>

          <Kicker className="mb-4">History</Kicker>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl bg-white/[0.05]" />
              ))}
            </div>
          ) : purchases.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="size-6" />}
              title="No purchases yet"
              description="Tap “Buy” to purchase molasses packs or supplies."
            />
          ) : (
            <Stagger className="space-y-2">
              {purchases.map((p) => (
                <StaggerItem key={p.id}>
                  <div className="glass flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.7)]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                      <Package className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.packCount} × {egp(p.unitCost)}/pack
                        {p.buyerName ? ` · by ${p.buyerName}` : ""} · {timeAgo(p.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display font-bold tabular-nums text-gold">
                        {egp(p.totalCost)}
                      </p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "mt-0.5 rounded-full ring-1",
                          p.kind === "molasses"
                            ? "border border-primary/30 bg-primary/10 text-primary ring-primary/20"
                            : "border border-amber-500/30 bg-amber-500/10 text-amber-400 ring-amber-500/20"
                        )}
                      >
                        {p.kind}
                      </Badge>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
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
        className="slim-scroll mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.175_0.016_60/0.96)] p-0 backdrop-blur-2xl"
      >
        <SheetGrip kicker="Procurement" />
        <SheetHeader className="px-5 pt-1 pb-2">
          <SheetTitle className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight text-gold-soft">
            <ShoppingCart className="size-5 text-primary" /> Buy stock
          </SheetTitle>
          <SheetDescription>
            Purchasing restocks inventory automatically and records the cost.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 pb-4">
          {/* tab switch */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "min-h-11 rounded-xl text-sm font-semibold transition-all active:scale-95",
                tab === "molasses"
                  ? "bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_10px_26px_-10px_oklch(0.72_0.145_60/0.55)]"
                  : "glass text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                setTab("molasses");
                setSelected(null);
              }}
            >
              Molasses packs
            </button>
            <button
              type="button"
              className={cn(
                "min-h-11 rounded-xl text-sm font-semibold transition-all active:scale-95",
                tab === "supply"
                  ? "bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_10px_26px_-10px_oklch(0.72_0.145_60/0.55)]"
                  : "glass text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                setTab("supply");
                setSelected(null);
              }}
            >
              Supplies
            </button>
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
                        "flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-all active:scale-[0.99]",
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-white/[0.08] bg-white/[0.04] hover:border-primary/50"
                      )}
                    >
                      <BrandMark brandId={b.id} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {pack.label} · {pack.grams}g
                        </p>
                      </div>
                      <span className="font-display font-semibold tabular-nums text-gold-soft">
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
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-all active:scale-[0.99]",
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-white/[0.08] bg-white/[0.04] hover:border-primary/50"
                    )}
                  >
                    <span className="text-xl">{s.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {packUnits} {s.unit} · {egp(s.cost)}/{s.unit.replace(/s$/, "")}
                      </p>
                    </div>
                    <span className="font-display font-semibold tabular-nums text-gold-soft">
                      {egp(packCost)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <>
              <div className="ember-hairline my-4" aria-hidden />
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
                  <div className="glass flex items-center justify-between rounded-xl p-2">
                    <button
                      type="button"
                      className="grid size-10 place-items-center rounded-full text-lg text-muted-foreground transition-all hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                      onClick={() => setPackCount((q) => Math.max(1, q - 1))}
                      disabled={packCount <= 1}
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span className="font-display min-w-12 text-center text-2xl font-bold tabular-nums text-gold">
                      {packCount}
                    </span>
                    <button
                      type="button"
                      className="grid size-10 place-items-center rounded-full text-lg text-muted-foreground transition-all hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                      onClick={() => setPackCount((q) => Math.min(999, q + 1))}
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <SheetFooter className="border-t border-white/[0.06] px-5 py-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total cost</span>
            <span className="font-display text-lg font-bold tabular-nums text-gold">
              {egp(total)}
            </span>
          </div>
          <GoldButton
            size="lg"
            className="w-full"
            disabled={!selected || saving}
            onClick={submit}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Buy & restock · ${egp(total)}`
            )}
          </GoldButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

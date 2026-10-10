"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  ShoppingCart,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BRANDS, SUPPLIES, egp } from "@/lib/catalog";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useI18n } from "@/store/i18n";
import type { EmployeeBranch } from "@/store/session";
import {
  EASE,
  GoldButton,
  Kicker,
  SheetGrip,
  Stagger,
  StaggerItem,
  StatTile,
} from "./kit/kit";

interface InventoryRow {
  id: string;
  brandId: string;
  brandName: string;
  stockGrams: number;
  lowStockThreshold: number;
  updatedAt: string;
  /** r57 — all-branches scope: per-branch breakdown of the total */
  branches?: { branchId: string; branchName: string; branchNameAr?: string | null; stockGrams: number }[];
}

interface SupplyRow {
  id: string;
  key: string;
  name: string;
  unit: string;
  stock: number;
  lowStockThreshold: number;
  cost: number;
  emoji: string;
  updatedAt: string;
  /** r57 — all-branches scope: per-branch breakdown of the total */
  branches?: { branchId: string; branchName: string; branchNameAr?: string | null; stock: number }[];
}

interface FlavorRow {
  id: string;
  brandIdRaw: string;
  brandName: string;
  flavorName: string;
  stockGrams: number;
  lowStockThreshold: number;
  updatedAt: string;
}

function hookahsFromGrams(g: number): number {
  return Math.floor(g / 20);
}

/* Gold-gradient stock meter with a glowing tip — animates on mount. */
function StockMeter({
  pct,
  low,
  delay = 0,
}: {
  pct: number;
  low: boolean;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 0.9, delay, ease: EASE }
        }
        className={cn(
          "relative h-full rounded-full",
          low
            ? "bg-gradient-to-r from-[oklch(0.78_0.17_70)] to-[oklch(0.62_0.2_30)]"
            : "bg-gradient-to-r from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)]"
        )}
      >
        {/* glow at the tip of the meter */}
        <span
          aria-hidden
          className={cn(
            "absolute end-0 top-1/2 size-2 -translate-y-1/2 rounded-full",
            low
              ? "bg-[oklch(0.72_0.19_35)] shadow-[0_0_10px_3px_oklch(0.62_0.2_30/0.75)]"
              : "bg-[oklch(0.93_0.09_82)] shadow-[0_0_10px_3px_oklch(0.78_0.15_65/0.7)]"
          )}
        />
      </motion.div>
    </div>
  );
}

export function InventoryPanel({ onSignOut }: { onSignOut: () => void }) {
  const { branchId, branchParam, branchName, branches } = useBranchScope();
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  // r57 — "all" = venue-admin aggregate scope → total inventory matrix
  const isAllScope = branchParam === "all";
  const scopeLabel = branchName ?? t("allBranches");

  const [rows, setRows] = React.useState<InventoryRow[]>([]);
  const [supplies, setSupplies] = React.useState<SupplyRow[]>([]);
  const [flavors, setFlavors] = React.useState<FlavorRow[]>([]);
  const [expandedBrand, setExpandedBrand] = React.useState<string | null>(null);
  const [restockBrand, setRestockBrand] = React.useState<InventoryRow | null>(null);
  const [restockSupply, setRestockSupply] = React.useState<SupplyRow | null>(null);
  const [restockFlavor, setRestockFlavor] = React.useState<FlavorRow | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = `?branchId=${encodeURIComponent(branchParam)}`;
      const [invRes, supRes, flavRes] = await Promise.all([
        fetch(`/api/inventory${q}`),
        fetch(`/api/supplies${q}`),
        fetch(`/api/flavor-stock${q}`),
      ]);
      const invData = await invRes.json();
      const supData = await supRes.json();
      const flavData = await flavRes.json();
      if (invData.ok) {
        const byId = new Map(invData.items.map((r: InventoryRow) => [r.brandId, r]));
        // spread the fetched row over the catalog default so the row always
        // carries an id (the all-scope aggregate omits it) + branches[]
        const merged = BRANDS.map(
          (b) =>
            ({
              id: b.id,
              brandId: b.id,
              brandName: b.name,
              stockGrams: 0,
              lowStockThreshold: 120,
              updatedAt: new Date().toISOString(),
              ...(byId.get(b.id) ?? {}),
            }) as InventoryRow
        );
        setRows(merged);
      } else {
        toast.error("Could not load inventory");
      }
      if (supData.ok) {
        const byKey = new Map(supData.items.map((r: SupplyRow) => [r.key, r]));
        const mergedSup = SUPPLIES.map(
          (s) =>
            ({
              id: s.key,
              key: s.key,
              name: s.name,
              unit: s.unit,
              stock: 0,
              lowStockThreshold: s.lowThreshold,
              cost: s.cost,
              emoji: s.emoji,
              updatedAt: new Date().toISOString(),
              ...(byKey.get(s.key) ?? {}),
            }) as SupplyRow
        );
        setSupplies(mergedSup);
      } else {
        toast.error("Could not load supplies");
      }
      if (flavData.ok) {
        setFlavors(flavData.items as FlavorRow[]);
      }
    } catch {
      toast.error("Could not load inventory");
    } finally {
      setLoading(false);
    }
  }, [branchParam]);

  React.useEffect(() => {
    load();
  }, [load]);

  const lowCount =
    rows.filter((r) => r.stockGrams <= r.lowStockThreshold).length +
    supplies.filter((s) => s.stock <= s.lowStockThreshold).length;

  const totalGrams = Math.round(rows.reduce((s, r) => s + r.stockGrams, 0));
  const totalHookahs = hookahsFromGrams(totalGrams);

  return (
    <div className="dark relative flex min-h-screen flex-col text-foreground">
      <div className="ember-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[oklch(0.155_0.014_60/0.72)] backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Boxes className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="font-display truncate text-xl font-bold tracking-tight text-gold-soft">
                Inventory
              </h1>
              <p className="-mt-0.5 truncate text-[11px] text-muted-foreground">
                {`Molasses stock · auto-deducted on order · ${scopeLabel}`}
              </p>
            </div>
            <div className="ms-auto flex shrink-0 items-center gap-2">
              {lowCount > 0 && (
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                >
                  <AlertTriangle className="size-3" /> {lowCount} low
                </Badge>
              )}
              <button
                type="button"
                onClick={() => load()}
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
          {/* Headline totals */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              key={`brands-${rows.length}`}
              value={rows.length}
              label="Brands tracked"
              icon={<Boxes className="size-4" />}
            />
            <StatTile
              key={`grams-${totalGrams}`}
              value={totalGrams}
              suffix="g"
              label="Total molasses"
              icon={<PackagePlus className="size-4" />}
            />
            <StatTile
              key={`hookahs-${totalHookahs}`}
              value={totalHookahs}
              label="Total hookahs left"
              icon={<Flame className="size-4" />}
            />
            <WarnStatTile value={lowCount} label="Low stock" />
          </div>

          {/* r57 — all-branches aggregate: the total inventory matrix */}
          {isAllScope && (
            <div className="mb-8">
              <Kicker>{t("invTotalAll")}</Kicker>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t("invMatrixHint")}
              </p>
            </div>
          )}

          {/* Supplies section */}
          <section className="mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Kicker>Supplies</Kicker>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                coal · foil
              </span>
            </div>
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.05]" />
                ))}
              </div>
            ) : (
              <Stagger className="grid gap-3 sm:grid-cols-3">
                {supplies.map((s, i) => {
                  const low = s.stock <= s.lowStockThreshold;
                  const def = SUPPLIES.find((d) => d.key === s.key);
                  const reusable = (def?.perHookah ?? 0) === 0;
                  const pct = Math.max(
                    4,
                    Math.min(100, (s.stock / (def?.defaultStock ?? 200)) * 100)
                  );
                  return (
                    <StaggerItem key={s.id} className="h-full">
                      <div
                        className={cn(
                          "glass relative flex h-full flex-col rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]",
                          low && "ring-1 ring-amber-500/30"
                        )}
                      >
                        {low && (
                          <div
                            className="pointer-events-none absolute inset-0 rounded-2xl bg-amber-500/[0.05]"
                            aria-hidden
                          />
                        )}
                        <div className="relative flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lg ring-1 ring-white/[0.08]">
                              {s.emoji}
                            </span>
                            <div>
                              <p className="font-semibold">{s.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {Math.round(s.stock)} {s.unit}
                                {s.cost > 0 && (
                                  <span className="ms-1 text-primary">
                                    · {egp(s.cost)}/{s.unit.replace(/s$/, "")}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          {low ? (
                            <LowPill />
                          ) : (
                            <InStockPill />
                          )}
                        </div>
                        {reusable && (
                          <p className="relative mt-2 text-[11px] text-muted-foreground">
                            ♻️ Reusable — not auto-deducted per order
                          </p>
                        )}
                        <div className="relative mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">stock</span>
                            <span className="text-muted-foreground">
                              min {Math.round(s.lowStockThreshold)}
                            </span>
                          </div>
                          <StockMeter pct={pct} low={low} delay={i * 0.05} />
                        </div>
                        {/* r57 matrix — per-branch breakdown chips */}
                        {isAllScope && (s.branches?.length ?? 0) > 0 && (
                          <div className="relative mt-3">
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              {t("invByBranch")}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {s.branches?.map((b) => {
                                const bLow =
                                  b.stock <= (s.lowStockThreshold || 120);
                                return (
                                  <span
                                    key={`${s.key}-${b.branchId}`}
                                    className={cn(
                                      "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                                      bLow
                                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                        : "border-white/[0.12] bg-white/[0.06] text-foreground/80"
                                    )}
                                  >
                                    {(lang === "ar" && b.branchNameAr) || b.branchName} · {Math.round(b.stock)}{" "}
                                    {s.unit}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="relative mt-auto w-full min-h-11 rounded-xl border-white/[0.1] bg-white/[0.03] hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                          onClick={() => setRestockSupply(s)}
                        >
                          <PackagePlus className="size-4" /> Restock
                        </Button>
                      </div>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            )}
          </section>

          {/* Molasses section */}
          <section>
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Kicker>Molasses</Kicker>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {rows.length} brands
              </span>
            </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.05]" />
              ))}
            </div>
          ) : (
            <Stagger className="grid gap-3 sm:grid-cols-2">
              {rows.map((r, i) => {
                const low = r.stockGrams <= r.lowStockThreshold;
                const brand = BRANDS.find((b) => b.id === r.brandId);
                const pct = Math.max(
                  4,
                  Math.min(100, (r.stockGrams / 1000) * 100)
                );
                return (
                  <StaggerItem key={r.id} className="h-full">
                    <div
                      className={cn(
                        "glass relative flex h-full flex-col rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]",
                        low && "ring-1 ring-amber-500/30"
                      )}
                    >
                      {low && (
                        <div
                          className="pointer-events-none absolute inset-0 rounded-2xl bg-amber-500/[0.05]"
                          aria-hidden
                        />
                      )}
                      <div className="relative flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lg ring-1 ring-white/[0.08]">
                            {brand?.emoji ?? "📦"}
                          </span>
                          <div>
                            <p className="font-semibold">{r.brandName}</p>
                            <p className="text-xs text-muted-foreground">
                              {hookahsFromGrams(r.stockGrams)} hookahs left
                            </p>
                          </div>
                        </div>
                        {low ? <LowPill /> : <InStockPill />}
                      </div>

                      <div className="relative mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-display font-semibold tabular-nums text-gold">
                            {Math.round(r.stockGrams)}g
                          </span>
                          <span className="text-muted-foreground">
                            threshold {Math.round(r.lowStockThreshold)}g
                          </span>
                        </div>
                        <StockMeter pct={pct} low={low} delay={i * 0.04} />
                      </div>

                      {/* r57 matrix — per-branch breakdown chips */}
                      {isAllScope && (r.branches?.length ?? 0) > 0 && (
                        <div className="relative mt-3">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {t("invByBranch")}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {r.branches?.map((b) => {
                              const bLow =
                                b.stockGrams <= (r.lowStockThreshold || 120);
                              return (
                                <span
                                  key={`${r.brandId}-${b.branchId}`}
                                  className={cn(
                                    "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                                    bLow
                                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                      : "border-white/[0.12] bg-white/[0.06] text-foreground/80"
                                  )}
                                >
                                  {(lang === "ar" && b.branchNameAr) || b.branchName} · {Math.round(b.stockGrams)}g
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="relative mt-3 w-full min-h-11 rounded-xl border-white/[0.1] bg-white/[0.03] hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                        onClick={() => setRestockBrand(r)}
                      >
                        <PackagePlus className="size-4" /> Restock
                      </Button>

                      {/* Per-flavor subtypes (expandable) */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBrand(expandedBrand === r.brandId ? null : r.brandId)
                        }
                        className="relative mt-2 flex min-h-10 w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        aria-expanded={expandedBrand === r.brandId}
                      >
                        <span>
                          Flavor stock ({flavors.filter((f) => f.brandIdRaw === r.brandId).length}{" "}
                          flavors)
                        </span>
                        <span>{expandedBrand === r.brandId ? "−" : "+"}</span>
                      </button>
                      {expandedBrand === r.brandId && (
                        <div className="relative mt-2">
                          {/* r57 — the all-scope list is summed across branches */}
                          {isAllScope && (
                            <p className="mb-1.5 px-1 text-[11px] text-muted-foreground">
                              {t("invMatrixHint")}
                            </p>
                          )}
                          <ul className="space-y-1">
                          {flavors
                            .filter((f) => f.brandIdRaw === r.brandId)
                            .map((f) => {
                              const fLow = f.stockGrams <= f.lowStockThreshold;
                              return (
                                <li
                                  key={f.id}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1"
                                >
                                  <span className="truncate text-sm">{f.flavorName}</span>
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={cn(
                                        "font-display text-sm font-semibold tabular-nums",
                                        fLow ? "text-amber-400" : "text-gold-soft"
                                      )}
                                    >
                                      {Math.round(f.stockGrams)}g
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setRestockFlavor(f)}
                                      className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                      aria-label={`Restock ${f.flavorName}`}
                                    >
                                      <PackagePlus className="size-4" />
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
          </section>

          {/* R49 forecast — burn rates, days until empty, shopping list */}
          <ForecastSection />
        </main>

        <footer className="relative mt-auto border-t border-white/[0.06] bg-[oklch(0.135_0.014_60/0.6)] py-6">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-1.5 px-4 text-center text-xs text-muted-foreground">
            <Flame className="size-3 text-primary" />
            Inventory auto-deducts 20g per hookah on every order
          </div>
        </footer>
      </div>

      {/* r57 — restock always targets a concrete branch: in the all-scope
          the sheets show a branch picker (submit gated until one is picked) */}
      <RestockSheet
        row={restockBrand}
        open={!!restockBrand}
        onOpenChange={(o) => !o && setRestockBrand(null)}
        onDone={load}
        branchId={branchId}
        branches={isAllScope ? branches : []}
      />
      <RestockSupplySheet
        row={restockSupply}
        open={!!restockSupply}
        onOpenChange={(o) => !o && setRestockSupply(null)}
        onDone={load}
        branchId={branchId}
        branches={isAllScope ? branches : []}
      />
      <RestockFlavorSheet
        row={restockFlavor}
        open={!!restockFlavor}
        onOpenChange={(o) => !o && setRestockFlavor(null)}
        onDone={load}
      />
    </div>
  );
}

/* Warm red/amber ring pill — low stock */
function LowPill() {
  return (
    <Badge
      variant="secondary"
      className="gap-1 shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
    >
      <AlertTriangle className="size-3" /> Low
    </Badge>
  );
}

/* Gold ring pill — healthy stock */
function InStockPill() {
  return (
    <Badge
      variant="secondary"
      className="shrink-0 rounded-full border border-primary/30 bg-primary/10 text-primary ring-1 ring-primary/20"
    >
      In stock
    </Badge>
  );
}

/* Amber stat tile for the low-stock count (mirrors StatTile aesthetics) */
function WarnStatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-center backdrop-blur-xl">
      <div
        className="pointer-events-none absolute -top-8 left-1/2 h-16 w-24 -translate-x-1/2 rounded-full bg-amber-500/20 blur-2xl"
        aria-hidden
      />
      <div className="relative mb-1.5 flex justify-center text-amber-400">
        <AlertTriangle className="size-4" />
      </div>
      <p className="font-display relative text-2xl font-bold tabular-nums text-amber-400">
        {value}
      </p>
      <p className="relative mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/* r57 — branch radio picker. The restock APIs need a concrete branchId;
 * the "all" scope never restocks directly, so the all-view sheets gate
 * submit until a branch is picked. */
function BranchPicker({
  branches,
  value,
  onChange,
}: {
  branches: EmployeeBranch[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  if (branches.length === 0) return null;
  return (
    <div>
      <Label className="mb-2 block text-xs font-medium text-muted-foreground">
        {t("chooseBranch")}
      </Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {branches.map((b) => {
          const selected = value === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onChange(b.id)}
              aria-pressed={selected}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 text-start text-sm font-medium transition-all active:scale-[0.98]",
                selected
                  ? "border border-primary/50 bg-primary/10 text-primary ring-1 ring-primary/40"
                  : "glass text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border",
                  selected ? "border-primary" : "border-white/25"
                )}
                aria-hidden
              >
                {selected && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="truncate">
                {(lang === "ar" && b.nameAr) || b.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RestockSheet({
  row,
  open,
  onOpenChange,
  onDone,
  branchId,
  branches,
}: {
  row: InventoryRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
  /** concrete-scope branch — its id is sent with the restock */
  branchId: string | null;
  /** all-scope: assignable branches (non-empty → picker, gated submit) */
  branches: EmployeeBranch[];
}) {
  const [grams, setGrams] = React.useState(500);
  const [saving, setSaving] = React.useState(false);
  const [branchSel, setBranchSel] = React.useState("");
  const needBranch = branches.length > 0;

  React.useEffect(() => {
    if (open) {
      setGrams(500);
      setBranchSel("");
    }
  }, [open]);

  if (!row) return null;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: row.brandId,
          addGrams: grams,
          branchId: branchSel || branchId,
        }),
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
      <SheetContent
        side="bottom"
        className="mx-auto w-full max-w-xl rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.175_0.016_60/0.96)] backdrop-blur-2xl"
      >
        <SheetGrip kicker="Restock" />
        <SheetHeader className="pb-0 pt-1">
          <SheetTitle className="font-display text-center text-2xl font-bold tracking-tight text-gold-soft">
            Restock {row.brandName}
          </SheetTitle>
          <SheetDescription className="text-center">
            Current: {Math.round(row.stockGrams)}g · adds molasses to this brand.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-2">
          {needBranch && (
            <div className="mb-4">
              <BranchPicker
                branches={branches}
                value={branchSel}
                onChange={setBranchSel}
              />
            </div>
          )}
          <Label className="mb-2 block text-xs font-medium text-muted-foreground">
            Amount (grams)
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setGrams(p)}
                className={cn(
                  "min-h-11 rounded-xl text-sm font-semibold transition-all active:scale-95",
                  grams === p
                    ? "bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_10px_26px_-10px_oklch(0.72_0.145_60/0.55)]"
                    : "glass text-muted-foreground hover:text-foreground"
                )}
              >
                {p}g
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            value={grams}
            onChange={(e) => setGrams(Math.max(1, Number(e.target.value)))}
            className="mt-3 h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] backdrop-blur-xl"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            = {hookahsFromGrams(grams)} extra hookahs worth
          </p>
        </div>

        <SheetFooter>
          <GoldButton
            size="lg"
            className="w-full"
            disabled={saving || (needBranch && !branchSel)}
            onClick={submit}
          >
            {saving ? "Saving…" : `Add ${grams}g`}
          </GoldButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RestockSupplySheet({
  row,
  open,
  onOpenChange,
  onDone,
  branchId,
  branches,
}: {
  row: SupplyRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
  /** concrete-scope branch — its id is sent with the restock */
  branchId: string | null;
  /** all-scope: assignable branches (non-empty → picker, gated submit) */
  branches: EmployeeBranch[];
}) {
  const [amount, setAmount] = React.useState(50);
  const [saving, setSaving] = React.useState(false);
  const [branchSel, setBranchSel] = React.useState("");
  const needBranch = branches.length > 0;

  React.useEffect(() => {
    if (open) {
      setAmount(50);
      setBranchSel("");
    }
  }, [open]);

  if (!row) return null;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/supplies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: row.key,
          addAmount: amount,
          branchId: branchSel || branchId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not restock");
      }
      toast.success(`Restocked ${row.name}`, {
        description: `+${amount} ${row.unit}`,
      });
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restock");
    } finally {
      setSaving(false);
    }
  };

  const presets = [20, 50, 100, 200];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto w-full max-w-xl rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.175_0.016_60/0.96)] backdrop-blur-2xl"
      >
        <SheetGrip kicker="Restock" />
        <SheetHeader className="pb-0 pt-1">
          <SheetTitle className="font-display flex items-center justify-center gap-2 text-center text-2xl font-bold tracking-tight text-gold-soft">
            <span>{row.emoji}</span> Restock {row.name}
          </SheetTitle>
          <SheetDescription className="text-center">
            Current: {Math.round(row.stock)} {row.unit} · adds stock.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-2">
          {needBranch && (
            <div className="mb-4">
              <BranchPicker
                branches={branches}
                value={branchSel}
                onChange={setBranchSel}
              />
            </div>
          )}
          <Label className="mb-2 block text-xs font-medium text-muted-foreground">
            Amount ({row.unit})
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className={cn(
                  "min-h-11 rounded-xl text-sm font-semibold transition-all active:scale-95",
                  amount === p
                    ? "bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_10px_26px_-10px_oklch(0.72_0.145_60/0.55)]"
                    : "glass text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
            className="mt-3 h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] backdrop-blur-xl"
          />
        </div>

        <SheetFooter>
          <GoldButton
            size="lg"
            className="w-full"
            disabled={saving || (needBranch && !branchSel)}
            onClick={submit}
          >
            {saving ? "Saving…" : `Add ${amount} ${row.unit}`}
          </GoldButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RestockFlavorSheet({
  row,
  open,
  onOpenChange,
  onDone,
}: {
  row: FlavorRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [grams, setGrams] = React.useState(150);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setGrams(150);
  }, [open]);

  if (!row) return null;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/flavor-stock/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addGrams: grams }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not restock");
      }
      toast.success(`Restocked ${row.flavorName}`, {
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

  const presets = [50, 100, 150, 300];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto w-full max-w-xl rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.175_0.016_60/0.96)] backdrop-blur-2xl"
      >
        <SheetGrip kicker="Restock" />
        <SheetHeader className="pb-0 pt-1">
          <SheetTitle className="font-display text-center text-2xl font-bold tracking-tight text-gold-soft">
            Restock {row.brandName} · {row.flavorName}
          </SheetTitle>
          <SheetDescription className="text-center">
            Current: {Math.round(row.stockGrams)}g · adds stock to this flavor
            (and the brand total).
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-2">
          <Label className="mb-2 block text-xs font-medium text-muted-foreground">
            Amount (grams)
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setGrams(p)}
                className={cn(
                  "min-h-11 rounded-xl text-sm font-semibold transition-all active:scale-95",
                  grams === p
                    ? "bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_10px_26px_-10px_oklch(0.72_0.145_60/0.55)]"
                    : "glass text-muted-foreground hover:text-foreground"
                )}
              >
                {p}g
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            value={grams}
            onChange={(e) => setGrams(Math.max(1, Number(e.target.value)))}
            className="mt-3 h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] backdrop-blur-xl"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            = {hookahsFromGrams(grams)} hookahs worth
          </p>
        </div>

        <SheetFooter>
          <GoldButton
            size="lg"
            className="w-full"
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Saving…" : `Add ${grams}g`}
          </GoldButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// R49 — Forecast section: burn rates, days until empty, suggested shopping list
// ---------------------------------------------------------------------------

interface ForecastData {
  windowDays: number;
  hookahsPerDay: number;
  brands: {
    brandId: string;
    brandName: string;
    emoji: string;
    stockGrams: number;
    gramsPerDay: number;
    daysLeft: number | null;
    hookahsLeft: number;
    lowStock: boolean;
    suggestedPacks: number;
    packLabel: string;
    packCost: number;
    suggestedCost: number;
  }[];
  flavors: {
    brandId: string;
    brandName: string;
    flavorName: string;
    stockGrams: number;
    daysLeft: number | null;
    critical: boolean;
  }[];
  supplies: {
    key: string;
    name: string;
    emoji: string;
    unit: string;
    stock: number;
    perDay: number;
    daysLeft: number | null;
    lowStock: boolean;
    suggestedBoxes: number;
    boxCost: number;
  }[];
  shoppingList: {
    kind: "molasses" | "supply";
    refId: string;
    name: string;
    cost: number;
  }[];
  shoppingTotal: number;
}

function daysLeftColor(days: number | null): string {
  if (days == null) return "text-muted-foreground";
  if (days <= 3) return "text-destructive";
  if (days <= 7) return "text-amber-400";
  return "text-gold-soft";
}

function ForecastSection() {
  const [data, setData] = React.useState<ForecastData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/forecast");
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

  if (loading && !data) {
    return (
      <section className="mt-8">
        <Kicker className="mb-4">Forecast</Kicker>
        <Skeleton className="h-40 rounded-2xl bg-white/[0.05]" />
      </section>
    );
  }
  if (!data) return null;

  return (
    <section className="mt-8">
      <div className="mb-4">
        <Kicker>Forecast</Kicker>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Burn rate from the last {data.windowDays} days · ~
          {data.hookahsPerDay} hookahs/day
        </p>
      </div>

      {/* days-until-empty per brand */}
      <Stagger className="grid gap-2 sm:grid-cols-2">
        {data.brands.map((b) => (
          <StaggerItem key={b.brandId} className="h-full">
            <div
              className={cn(
                "glass relative flex h-full items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.7)]",
                b.daysLeft != null && b.daysLeft <= 3 && "ring-1 ring-destructive/40"
              )}
            >
              <span className="text-xl">{b.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.brandName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {b.stockGrams}g · {b.hookahsLeft} hookahs · {b.gramsPerDay}g/day
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "flex items-center gap-1 font-display text-base font-bold tabular-nums",
                    daysLeftColor(b.daysLeft)
                  )}
                >
                  <CalendarClock className="size-3.5" />
                  {b.daysLeft != null ? `${b.daysLeft}d` : "—"}
                </p>
                {b.suggestedPacks > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    buy {b.suggestedPacks}× {b.packLabel}
                  </p>
                )}
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* critical flavors */}
      {data.flavors.length > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-400">
            <AlertTriangle className="size-4" /> Flavors running dry
          </p>
          <ul className="space-y-1">
            {data.flavors.map((f) => (
              <li
                key={`${f.brandId}-${f.flavorName}`}
                className="flex items-center justify-between text-xs"
              >
                <span>
                  {f.brandName} · {f.flavorName}
                </span>
                <span className="font-medium tabular-nums text-amber-400">
                  {f.stockGrams}g
                  {f.daysLeft != null ? ` · ${f.daysLeft}d left` : " · low"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* supplies days left */}
      <div className="mt-3 flex flex-wrap gap-2">
        {data.supplies.map((s) => (
          <div
            key={s.key}
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-white/[0.04] px-3 py-2 text-xs",
              s.lowStock ? "border-amber-500/40" : "border-white/[0.08]"
            )}
          >
            <span>{s.emoji}</span>
            <span className="font-medium">{s.name}</span>
            <span className={cn("font-semibold tabular-nums", daysLeftColor(s.daysLeft))}>
              {s.daysLeft != null ? `${s.daysLeft}d` : `${s.stock} ${s.unit}`}
            </span>
          </div>
        ))}
      </div>

      {/* suggested shopping list */}
      {data.shoppingList.length > 0 && (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
          <div
            className="pointer-events-none absolute -top-10 end-0 size-32 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <div className="relative mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold">
              <ShoppingCart className="size-4 text-primary" /> Suggested
              shopping list
            </p>
            <span className="text-xs text-muted-foreground">
              30-day cover ·{" "}
              <b className="font-display text-gold">{egp(data.shoppingTotal)}</b>
            </span>
          </div>
          <ul className="relative space-y-1">
            {data.shoppingList.map((item) => (
              <li
                key={`${item.kind}-${item.refId}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-display font-semibold tabular-nums text-gold-soft">
                  {egp(item.cost)}
                </span>
              </li>
            ))}
          </ul>
          <p className="relative mt-2 text-[11px] text-muted-foreground">
            Head to the <b>Buy</b> tab to purchase these packs — stock is
            restocked automatically.
          </p>
        </div>
      )}
    </section>
  );
}

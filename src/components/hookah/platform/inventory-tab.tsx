"use client";

/**
 * r61 — Platform Control Center · INVENTORY tab.
 *
 * The owner's cross-venue stock matrix for the shisha operation:
 *   • platform totals per brand (the aggregate view)
 *   • per-branch jars + supplies with low-stock flags
 *   • a prioritized alert list (worst first)
 */

import * as React from "react";
import {
  AlertTriangle,
  Boxes,
  Loader2,
  Package,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MOLASSES_GRAMS, getBrand } from "@/lib/catalog";
import type { Lang } from "@/lib/i18n";
import { useI18n } from "@/store/i18n";
import { BrandMark } from "../brand-mark";
import { CineCard, EmptyState, GoldButton, Kicker, Stagger, StaggerItem } from "../kit/kit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface BrandRow {
  brandId: string;
  brandName: string;
  stockGrams: number;
  lowStock: boolean;
  flavors: { name: string; grams: number }[];
}
interface SupplyRow {
  key: string;
  name: string;
  emoji: string;
  unit: string;
  stock: number;
  lowStock: boolean;
}
interface BranchBlock {
  id: string;
  name: string;
  nameAr: string | null;
  isActive: boolean;
  venue: { id: string; name: string; nameAr: string | null; status: string };
  jars: BrandRow[];
  supplies: SupplyRow[];
  lowStockCount: number;
}
interface MatrixData {
  ok: boolean;
  perBranch: BranchBlock[];
  perBrand: { brandId: string; grams: number; hookahs: number; branches: number }[];
  alerts: {
    branchId: string;
    branchName: string;
    venueName: string;
    kind: "molasses" | "supply";
    name: string;
    level: number;
  }[];
  totals: { branches: number; brandKinds: number; totalGrams: number; alertCount: number };
}

function pickName(name: string, nameAr: string | null, lang: Lang): string {
  return lang === "ar" && nameAr ? nameAr : name;
}

/* ------------------------------------------------------------------ */
/* InventoryTab                                                        */
/* ------------------------------------------------------------------ */

export function InventoryTab({ employeeId }: { employeeId: string }) {
  const { t, lang } = useI18n();
  const [data, setData] = React.useState<MatrixData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [openBranch, setOpenBranch] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(
          `/api/platform/inventory?employeeId=${encodeURIComponent(employeeId)}`
        );
        const json = (await res.json()) as MatrixData & { error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? t("failed"));
        setData(json);
        setOpenBranch((prev) => prev ?? json.perBranch[0]?.id ?? null);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t("failed"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [employeeId, t]
  );

  React.useEffect(() => {
    void load();
    const onRefresh = () => void load(true);
    window.addEventListener("mazaj:platform-refresh", onRefresh);
    return () => window.removeEventListener("mazaj:platform-refresh", onRefresh);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<WifiOff className="size-6" />}
        title={t("failed")}
        description={error ?? ""}
        action={
          <GoldButton size="sm" className="h-11" onClick={() => void load()}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t("retry")}
          </GoldButton>
        }
      />
    );
  }

  const maxGrams = Math.max(...data.perBrand.map((b) => b.grams), 1);

  return (
    <div className="space-y-6">
      {/* platform-wide brand totals */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <Kicker className="justify-start">{t("pccStockTitle")}</Kicker>
          <span className="text-[11px] text-muted-foreground">
            {t("pccStockTotal", { grams: Math.round(data.totals.totalGrams) })}
          </span>
        </div>
        <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.perBrand.map((b) => {
            const brand = getBrand(b.brandId);
            const pct = Math.max(6, Math.round((b.grams / maxGrams) * 100));
            return (
              <StaggerItem key={b.brandId}>
                <CineCard className="p-3.5">
                  <div className="flex items-center gap-2.5">
                    {brand && <BrandMark brandId={b.brandId} size="xs" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground/90">{brand?.name ?? b.brandId}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {b.hookahs} {t("pccHookahsShort")} · {b.branches} {t("pccBranchesShort")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" dir="ltr">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {b.grams} g
                  </p>
                </CineCard>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      {/* alerts */}
      {data.alerts.length > 0 && (
        <section>
          <Kicker className="mb-3 justify-start">
            <AlertTriangle className="size-3.5" aria-hidden />
            {t("pccAlertsTitle")}
          </Kicker>
          <ul className="space-y-2">
            {data.alerts.slice(0, 6).map((a, i) => (
              <li
                key={`${a.branchId}-${a.name}-${i}`}
                className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5 ring-1 ring-inset ring-amber-500/15"
              >
                <AlertTriangle className="size-4 shrink-0 text-amber-400" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-sm text-foreground/90">
                  {a.name} · {a.venueName} · {a.branchName}
                </p>
                <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-inset ring-amber-500/30">
                  {a.level}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* per-branch matrix (accordion) */}
      <section>
        <Kicker className="mb-3 justify-start">{t("pccByBranchTitle")}</Kicker>
        <div className="space-y-2">
          {data.perBranch.map((b) => {
            const open = openBranch === b.id;
            return (
              <CineCard key={b.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenBranch(open ? null : b.id)}
                  aria-expanded={open}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-start"
                >
                  <Boxes className="size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground/90">
                      {pickName(b.name, b.nameAr, lang)}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {pickName(b.venue.name, b.venue.nameAr, lang)}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.jars.length} {t("pccBrandsShort")} · {b.supplies.length} {t("pccSuppliesShort")}
                    </p>
                  </div>
                  {b.lowStockCount > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-inset ring-amber-500/30">
                      {b.lowStockCount}
                    </span>
                  )}
                  <span
                    className={cn(
                      "shrink-0 text-muted-foreground transition-transform duration-300",
                      open && "rotate-180"
                    )}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>

                {open && (
                  <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
                    {/* molasses jars */}
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {b.jars.map((j) => (
                        <div
                          key={j.brandId}
                          className={cn(
                            "flex min-h-11 items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 ring-1 ring-inset",
                            j.lowStock ? "ring-amber-500/30" : "ring-white/[0.06]"
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate text-xs text-foreground/85">
                            {j.brandName}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {Math.floor(j.stockGrams / MOLASSES_GRAMS)} {t("pccHookahsShort")}
                          </span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-gold">
                            {j.stockGrams}g
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* supplies */}
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {b.supplies.map((s) => (
                        <div
                          key={s.key}
                          className={cn(
                            "flex min-h-11 items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 ring-1 ring-inset",
                            s.lowStock ? "ring-amber-500/30" : "ring-white/[0.06]"
                          )}
                        >
                          <span aria-hidden>{s.emoji}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-foreground/85">
                            {s.name}
                          </span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-gold">
                            {s.stock} {s.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                    {b.jars.length === 0 && b.supplies.length === 0 && (
                      <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <Package className="size-3.5" aria-hidden />
                        {t("pccNoStock")}
                      </p>
                    )}
                  </div>
                )}
              </CineCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* exported for potential toast flows */
export function InventoryRefreshHint() {
  return <Loader2 className="size-4 animate-spin" aria-hidden />;
}

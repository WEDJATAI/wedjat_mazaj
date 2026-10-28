"use client";

/**
 * r61 — Platform Control Center · MENU tab.
 *
 * The shisha menu is the PLATFORM's own product (WEDJAT operates the
 * corners; the venues rent them). This tab is the owner's price desk:
 * every brand with its real logo, current EFFECTIVE pricing, the
 * compiled defaults (one-tap reset), flavor list and pack economics.
 * Saving publishes to every client instantly via /api/menu/pricing.
 */

import * as React from "react";
import { BadgeCheck, Loader2, Pencil, RefreshCw, RotateCcw, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";
import { egp } from "@/lib/catalog";
import { useI18n } from "@/store/i18n";
import { BrandMark } from "../brand-mark";
import { CineCard, EmptyState, GoldButton, Kicker, Stagger, StaggerItem } from "../kit/kit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface MenuBrand {
  id: string;
  name: string;
  logo: string;
  category: string;
  badge: string | null;
  flavorCount: number;
  flavors: string[];
  packs: { grams: number; label: string; costEgp: number }[];
  pricing: { fruits?: number; fruitsMix?: number; flat?: number };
  defaults: { fruits?: number; fruitsMix?: number; flat?: number };
  overridden: boolean;
}

/* ------------------------------------------------------------------ */
/* MenuTab                                                             */
/* ------------------------------------------------------------------ */

export function MenuTab() {
  const { t, lang } = useI18n();
  const [brands, setBrands] = React.useState<MenuBrand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editBrand, setEditBrand] = React.useState<MenuBrand | null>(null);

  const load = React.useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(`/api/platform/menu`);
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          brands?: MenuBrand[];
        };
        if (!res.ok || !data.ok || !Array.isArray(data.brands)) {
          throw new Error(data.error ?? t("failed"));
        }
        setBrands(data.brands);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t("failed"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [t]
  );

  React.useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener("mazaj:platform-refresh", onRefresh);
    return () => window.removeEventListener("mazaj:platform-refresh", onRefresh);
  }, [load]);

  const overriddenCount = brands.filter((b) => b.overridden).length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Kicker className="justify-start">{t("pccMenuTitle")}</Kicker>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("pccMenuDesc")}</p>
        </div>
        {overriddenCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
            <BadgeCheck className="size-3" aria-hidden />
            {t("pccMenuOverridden", { count: overriddenCount })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<WifiOff className="size-6" />}
          title={t("failed")}
          description={error}
          action={
            <GoldButton size="sm" className="h-11" onClick={() => void load()}>
              <RefreshCw className="size-3.5" aria-hidden />
              {t("retry")}
            </GoldButton>
          }
        />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2">
          {brands.map((b) => (
            <StaggerItem key={b.id} className="h-full">
              <CineCard className="flex h-full flex-col p-4">
                <div className="flex items-start gap-3">
                  <BrandMark brandId={b.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display truncate text-lg font-bold tracking-tight text-gold-soft">
                        {b.name}
                      </p>
                      {b.badge && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary ring-1 ring-inset ring-primary/25">
                          {b.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {b.flavorCount} {t("pccFlavors")} ·{" "}
                      {b.packs.map((p) => p.label).join(" / ")}
                    </p>
                  </div>
                  {b.overridden && (
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-inset ring-amber-500/30">
                      {t("pccCustom")}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {typeof b.pricing.fruits === "number" && (
                    <PriceCell
                      label={t("pccFruits")}
                      value={b.pricing.fruits}
                      def={b.defaults.fruits}
                      lang={lang}
                    />
                  )}
                  {typeof b.pricing.fruitsMix === "number" && (
                    <PriceCell
                      label={t("pccFruitsMix")}
                      value={b.pricing.fruitsMix}
                      def={b.defaults.fruitsMix}
                      lang={lang}
                    />
                  )}
                  {typeof b.pricing.flat === "number" && (
                    <PriceCell
                      label={t("pccFlat")}
                      value={b.pricing.flat}
                      def={b.defaults.flat}
                      lang={lang}
                      className="col-span-2"
                    />
                  )}
                </div>

                <div className="mt-auto pt-3">
                  <button
                    type="button"
                    onClick={() => setEditBrand(b)}
                    className="glass flex h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-foreground/85 ring-1 ring-inset ring-white/[0.09] transition-colors hover:border-primary/35 hover:text-primary"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    {t("pccEditPricing")}
                  </button>
                </div>
              </CineCard>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <EditPricingDialog
        brand={editBrand}
        onOpenChange={(o) => {
          if (!o) setEditBrand(null);
        }}
        onSaved={() => void load(true)}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* PriceCell — one price stat with default-delta hint                   */
/* ------------------------------------------------------------------ */

function PriceCell({
  label,
  value,
  def,
  lang,
  className,
}: {
  label: string;
  value: number;
  def?: number;
  lang: Lang;
  className?: string;
}) {
  const changed = def !== undefined && Math.abs(def - value) > 0.001;
  return (
    <div
      className={cn(
        "rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-inset ring-white/[0.06]",
        changed && "ring-amber-500/30",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="font-display mt-0.5 text-lg font-bold tabular-nums text-gold">
        {egp(value, lang)}
        {changed && def !== undefined && (
          <span className="ms-1.5 text-[10px] font-medium text-amber-300/80">
            ({def > value ? "−" : "+"}
            {egp(Math.abs(def - value), lang)})
          </span>
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EditPricingDialog — set new prices / reset to default                */
/* ------------------------------------------------------------------ */

function EditPricingDialog({
  brand,
  onOpenChange,
  onSaved,
}: {
  brand: MenuBrand | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [fruits, setFruits] = React.useState("");
  const [fruitsMix, setFruitsMix] = React.useState("");
  const [flat, setFlat] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const open = brand !== null;

  React.useEffect(() => {
    if (brand) {
      setFruits(brand.pricing.fruits != null ? String(brand.pricing.fruits) : "");
      setFruitsMix(brand.pricing.fruitsMix != null ? String(brand.pricing.fruitsMix) : "");
      setFlat(brand.pricing.flat != null ? String(brand.pricing.flat) : "");
      setSending(false);
    }
  }, [brand]);

  const parse = (s: string) => {
    const n = Number(s);
    return s.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const valid =
    !!brand &&
    (brand.defaults.fruits !== undefined ? parse(fruits) !== undefined : true) &&
    (brand.defaults.fruitsMix !== undefined ? parse(fruitsMix) !== undefined : true) &&
    (brand.defaults.flat !== undefined ? parse(flat) !== undefined : true);

  const dirty =
    !!brand &&
    ((brand.defaults.fruits !== undefined && parse(fruits) !== brand.pricing.fruits) ||
      (brand.defaults.fruitsMix !== undefined && parse(fruitsMix) !== brand.pricing.fruitsMix) ||
      (brand.defaults.flat !== undefined && parse(flat) !== brand.pricing.flat));

  const submit = async (resetToDefault: boolean) => {
    if (!brand || sending) return;
    const next = resetToDefault
      ? brand.defaults
      : {
          ...(parse(fruits) !== undefined ? { fruits: parse(fruits) } : {}),
          ...(parse(fruitsMix) !== undefined ? { fruitsMix: parse(fruitsMix) } : {}),
          ...(parse(flat) !== undefined ? { flat: parse(flat) } : {}),
        };
    setSending(true);
    try {
      const res = await fetch("/api/platform/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing: { [brand.id]: next } }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("failed"));
      toast.success(resetToDefault ? t("pccMenuResetToast") : t("pccMenuSavedToast"), {
        description: t("pccMenuPublishDesc"),
      });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] backdrop-blur-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-gold-soft">
            {brand ? <BrandMark brandId={brand.id} size="sm" /> : null}
            {brand?.name}
          </DialogTitle>
          <DialogDescription>{t("pccEditPricingDesc")}</DialogDescription>
        </DialogHeader>

        {brand && (
          <div className="space-y-3">
            {brand.defaults.fruits !== undefined && (
              <div className="space-y-1.5">
                <Label htmlFor="mp-fruits" className="text-xs text-muted-foreground">
                  {t("pccFruits")} ({t("pccDefaultLabel")}: {brand.defaults.fruits})
                </Label>
                <Input
                  id="mp-fruits"
                  value={fruits}
                  onChange={(e) => setFruits(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
                />
              </div>
            )}
            {brand.defaults.fruitsMix !== undefined && (
              <div className="space-y-1.5">
                <Label htmlFor="mp-mix" className="text-xs text-muted-foreground">
                  {t("pccFruitsMix")} ({t("pccDefaultLabel")}: {brand.defaults.fruitsMix})
                </Label>
                <Input
                  id="mp-mix"
                  value={fruitsMix}
                  onChange={(e) => setFruitsMix(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
                />
              </div>
            )}
            {brand.defaults.flat !== undefined && (
              <div className="space-y-1.5">
                <Label htmlFor="mp-flat" className="text-xs text-muted-foreground">
                  {t("pccFlat")} ({t("pccDefaultLabel")}: {brand.defaults.flat})
                </Label>
                <Input
                  id="mp-flat"
                  value={flat}
                  onChange={(e) => setFlat(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  className="h-11 rounded-xl border-white/[0.09] bg-white/[0.04]"
                />
              </div>
            )}

            <GoldButton
              className="h-12 w-full"
              disabled={!valid || sending || (!dirty && !brand.overridden)}
              onClick={() => void submit(false)}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <BadgeCheck className="size-4" aria-hidden />
              )}
              {t("pccPublishPrices")}
            </GoldButton>

            <button
              type="button"
              disabled={sending || !brand.overridden}
              onClick={() => void submit(true)}
              className="glass flex h-11 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-foreground/85 ring-1 ring-inset ring-white/[0.09] transition-colors hover:border-primary/35 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t("pccResetToDefault")}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

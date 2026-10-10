"use client";

import * as React from "react";
import { useCart, computeTotals, OwnType, flavorSummary } from "@/store/cart";
import { chargeableQty, egp, SELLABLE_ADDONS, getSupply } from "@/lib/catalog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Sparkles,
  Wind,
  FlaskRound,
  PartyPopper,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/store/i18n";
import { EmptyState, GoldButton, Kicker } from "./kit/kit";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckout: () => void;
}

const OWN_OPTIONS: {
  value: Exclude<OwnType, null>;
  labelKey: "ownHookahLabel" | "ownMolassesLabel";
  descKey: "ownHookahDesc" | "ownMolassesDesc";
  icon: React.ReactNode;
}[] = [
  {
    value: "hookah",
    labelKey: "ownHookahLabel",
    descKey: "ownHookahDesc",
    icon: <Wind className="size-4" />,
  },
  {
    value: "molasses",
    labelKey: "ownMolassesLabel",
    descKey: "ownMolassesDesc",
    icon: <FlaskRound className="size-4" />,
  },
];

export function CartDrawer({ open, onOpenChange, onCheckout }: CartDrawerProps) {
  const t = useI18n((s) => s.t);
  const items = useCart((s) => s.items);
  const ownType = useCart((s) => s.ownType);
  const addons = useCart((s) => s.addons);
  const toggleAddon = useCart((s) => s.toggleAddon);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);
  const setOwnType = useCart((s) => s.setOwnType);

  const addonTotal = addons.reduce(
    (sum, k) => sum + (getSupply(k)?.sellPrice ?? 0),
    0
  );
  const totals = computeTotals(items, ownType);
  const grandTotal = totals.total + addonTotal;
  const bogo = totals.bogo;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] p-0 backdrop-blur-2xl sm:max-w-md"
      >
        {/* ── glass header with display title ── */}
        <SheetHeader className="gap-1 border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <ShoppingBag className="size-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <SheetTitle className="font-display text-xl font-bold tracking-tight text-gold-soft">
                {t("currentOrder")}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {t("each20g")}
              </SheetDescription>
            </div>
            {totals.totalQty > 0 && (
              <span className="ms-auto shrink-0 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {totals.totalQty}{" "}
                {totals.totalQty > 1 ? t("bowls") : t("bowl")}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="slim-scroll flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full min-h-72 items-center justify-center">
              <EmptyState
                className="w-full"
                icon={<ShoppingBag className="size-7" />}
                title={t("emptyCart")}
                description={t("emptyCartDesc")}
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => {
                const charged = chargeableQty(it.qty, bogo);
                const free = it.qty - charged;
                return (
                  <li
                    key={it.id}
                    className="glass rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-xl",
                          it.accent
                        )}
                      >
                        {it.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {it.primaryBrandName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {it.flavorLabel} · {egp(it.unitPrice)} · 20g
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(it.id)}
                            className="-me-1 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                            aria-label={`Remove ${it.primaryBrandName}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>

                        {/* flavor summary */}
                        <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                          {flavorSummary(it)}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                            <button
                              type="button"
                              className="grid size-11 place-items-center rounded-s-xl text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                              onClick={() => setQty(it.id, it.qty - 1)}
                              aria-label="Decrease"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
                              {it.qty}
                            </span>
                            <button
                              type="button"
                              className="grid size-11 place-items-center rounded-e-xl text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                              onClick={() => setQty(it.id, it.qty + 1)}
                              aria-label="Increase"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <div className="text-end">
                            <p className="font-display font-bold tabular-nums text-gold">
                              {egp(it.unitPrice * charged)}
                            </p>
                            {bogo && free > 0 && (
                              <p className="text-[11px] font-medium text-primary">
                                {free} {t("freeWord")} · {charged}{" "}
                                {t("chargedWord")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-white/[0.08] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            {/* BYO promo */}
            <div className="glass mb-4 rounded-2xl p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
                  <Sparkles className="size-3.5" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {t("byoTitle")}
                </p>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("byoDesc")}
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setOwnType(null)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-2.5 text-start transition-all duration-300",
                    ownType === null
                      ? "border-primary/40 bg-primary/10 ring-1 ring-primary/40"
                      : "border-white/[0.08] bg-white/[0.04] hover:border-primary/40 hover:bg-white/[0.06]"
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-muted-foreground ring-1 ring-white/[0.08]">
                    <PartyPopper className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t("loungeSetup")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("loungeSetupDesc")}
                    </p>
                  </div>
                  {ownType === null && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                </button>
                {OWN_OPTIONS.map((opt) => {
                  const active = ownType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOwnType(opt.value)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2.5 text-start transition-all duration-300",
                        active
                          ? "border-primary/40 bg-primary/10 ring-1 ring-primary/40"
                          : "border-white/[0.08] bg-white/[0.04] hover:border-primary/40 hover:bg-white/[0.06]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl ring-1 transition-colors",
                          active
                            ? "bg-primary/15 text-primary ring-primary/25"
                            : "bg-white/[0.05] text-muted-foreground ring-white/[0.08]"
                        )}
                      >
                        {opt.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t(opt.labelKey)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t(opt.descKey)}
                        </p>
                      </div>
                      {active && (
                        <Check className="size-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add-ons (medical hose etc.) */}
            {SELLABLE_ADDONS.length > 0 && (
              <div className="mb-3 space-y-2.5">
                <Kicker>{t("addons")}</Kicker>
                {SELLABLE_ADDONS.map((a) => {
                  const on = addons.includes(a.key);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => toggleAddon(a.key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2.5 text-start transition-all duration-300",
                        on
                          ? "border-primary/40 bg-primary/10 ring-1 ring-primary/40"
                          : "border-white/[0.08] bg-white/[0.04] hover:border-primary/40 hover:bg-white/[0.06]"
                      )}
                    >
                      <span className="text-xl">{a.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("personalHose")} ·{" "}
                          <span className="font-display font-bold tabular-nums text-gold">
                            +{egp(a.sellPrice)}
                          </span>
                        </p>
                      </div>
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-md border text-[10px] transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-white/[0.15]"
                        )}
                      >
                        {on ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <span className="ember-hairline my-3 block w-full" aria-hidden />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t("subtotal")}</span>
                <span className="tabular-nums">{egp(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between font-medium text-primary">
                  <span>{t("byoSaving")}</span>
                  <span className="tabular-nums">−{egp(totals.discount)}</span>
                </div>
              )}
              {addonTotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("addons")}</span>
                  <span className="tabular-nums">+{egp(addonTotal)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1.5">
                <span className="font-semibold">{t("total")}</span>
                <span className="font-display text-2xl font-bold tabular-nums text-gold">
                  {egp(grandTotal)}
                </span>
              </div>
            </div>

            <GoldButton
              size="lg"
              className="mt-4 w-full"
              onClick={onCheckout}
            >
              {t("checkout")} · {egp(grandTotal)}
            </GoldButton>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

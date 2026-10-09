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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Sparkles,
  Wind,
  FlaskRound,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/store/i18n";

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
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            <SheetTitle className="text-lg">{t("currentOrder")}</SheetTitle>
            {totals.totalQty > 0 && (
              <Badge
                variant="secondary"
                className="ml-auto bg-primary/15 text-primary"
              >
                {totals.totalQty} {totals.totalQty > 1 ? t("bowls") : t("bowl")}
              </Badge>
            )}
          </div>
          <SheetDescription>{t("each20g")}</SheetDescription>
        </SheetHeader>

        <div className="slim-scroll flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-muted/50">
                <ShoppingBag className="size-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{t("emptyCart")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("emptyCartDesc")}
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => {
                const charged = chargeableQty(it.qty, bogo);
                const free = it.qty - charged;
                return (
                  <li
                    key={it.id}
                    className="rounded-2xl border border-border bg-card p-3"
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
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove ${it.primaryBrandName}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>

                        {/* flavor summary */}
                        <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                          {flavorSummary(it)}
                        </p>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1 rounded-lg border border-border bg-background">
                            <button
                              type="button"
                              className="grid size-8 place-items-center rounded-l-lg text-muted-foreground hover:bg-muted"
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
                              className="grid size-8 place-items-center rounded-r-lg text-muted-foreground hover:bg-muted"
                              onClick={() => setQty(it.id, it.qty + 1)}
                              aria-label="Increase"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {egp(it.unitPrice * charged)}
                            </p>
                            {bogo && free > 0 && (
                              <p className="text-[11px] font-medium text-primary">
                                {free} {t("freeWord")} · {charged} {t("chargedWord")}
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
          <div className="border-t border-border px-5 py-4">
            {/* BYO promo */}
            <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
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
                    "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
                    ownType === null
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <PartyPopper className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("loungeSetup")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("loungeSetupDesc")}
                    </p>
                  </div>
                </button>
                {OWN_OPTIONS.map((opt) => {
                  const active = ownType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOwnType(opt.value)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
                        active
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      <span className="text-primary">{opt.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t(opt.labelKey)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t(opt.descKey)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="my-3" />

            {/* Add-ons (medical hose etc.) */}
            {SELLABLE_ADDONS.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("addons")}
                </p>
                {SELLABLE_ADDONS.map((a) => {
                  const on = addons.includes(a.key);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => toggleAddon(a.key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
                        on
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      <span className="text-xl">{a.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("personalHose")} · +{egp(a.sellPrice)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-md border text-[10px] transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        )}
                      >
                        {on ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <Separator className="my-3" />

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
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-semibold">{t("total")}</span>
                <span className="text-xl font-bold tabular-nums">
                  {egp(grandTotal)}
                </span>
              </div>
            </div>

            <Button
              size="lg"
              className="mt-4 w-full rounded-xl text-base font-semibold"
              onClick={onCheckout}
            >
              {t("checkout")} · {egp(grandTotal)}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

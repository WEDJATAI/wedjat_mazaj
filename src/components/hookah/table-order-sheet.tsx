"use client";

// r67 — TABLE ORDER SHEET
// The guest's shared-table draft: every shisha added by the wizard stacks
// here, each with its OWN config (person, BYO answer, pipe, molasses),
// editable and removable individually before the table order is sent.

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { chargeableQty, egp } from "@/lib/catalog";
import { type CartItem, computeTotals, useCart } from "@/store/cart";
import {
  Check,
  Backpack,
  Crown,
  Pencil,
  Plus,
  Send,
  Trash2,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/store/i18n";
import { toast } from "sonner";
import { haptic } from "@/lib/delight";
import { BrandStack } from "./brand-mark";
import { GoldButton, Kicker } from "./kit/kit";

interface TableOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the guest's table label (shown in the header) */
  tableLabel?: string;
  onEdit: (item: CartItem) => void;
  onAddAnother: () => void;
  onSend: () => void;
}

export function TableOrderSheet({
  open,
  onOpenChange,
  tableLabel,
  onEdit,
  onAddAnother,
  onSend,
}: TableOrderSheetProps) {
  const t = useI18n((s) => s.t);
  const items = useCart((s) => s.items);
  const ownType = useCart((s) => s.ownType);
  const removeItem = useCart((s) => s.removeItem);
  const totals = computeTotals(items, ownType);

  const remove = (item: CartItem) => {
    haptic("error");
    removeItem(item.id);
    toast(t("orderCardDeleted"), { description: item.forName ?? item.primaryBrandName });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] p-0 backdrop-blur-2xl"
      >
        <SheetHeader className="gap-2.5 px-5 pb-3 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/15" aria-hidden />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                {t("wizTableOrder")}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs">
                {tableLabel ? `${tableLabel} · ` : ""}
                {items.length} × {t("wizShishaCount")} ·{" "}
                <span className="font-display font-bold tabular-nums text-gold">
                  {egp(totals.total)}
                </span>
                {totals.bogo ? ` · ${t("wizByoBadge")}` : ""}
              </SheetDescription>
            </div>
          </div>
          <span className="ember-hairline w-full" aria-hidden />
        </SheetHeader>

        <div className="space-y-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          {/* the shisha stack */}
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
              {t("wizEmptyTable")}
            </div>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((item, idx) => {
                  const bogo = item.ownType === "hookah" || item.ownType === "molasses";
                  const charge = item.unitPrice * chargeableQty(item.qty, bogo);
                  return (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      className="glass relative flex items-center gap-3 rounded-2xl p-3"
                    >
                      <div
                        className="pointer-events-none absolute -end-6 -top-8 size-24 rounded-full bg-primary/10 blur-2xl"
                        aria-hidden
                      />
                      {/* index badge */}
                      <span className="glass relative grid size-9 shrink-0 place-items-center rounded-xl font-display text-sm font-bold tabular-nums text-gold ring-1 ring-primary/20">
                        {idx + 1}
                      </span>
                      <div className="relative min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {item.forName || `${t("wizShishaNum")} ${idx + 1}`}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.components.length === 0
                            ? t("wizOwnMolassesTag")
                            : item.components.map((c) => c.flavorName).join(" + ")}
                        </p>
                        {/* config chips */}
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                          {item.ownType === "molasses" && (
                            <Tag icon={<Backpack className="size-2.5" />} label={t("wizOwnMolassesTag")} tone="emerald" />
                          )}
                          {item.ownType === "hookah" && (
                            <Tag icon={<Wind className="size-2.5" />} label={t("wizOwnHookahTag")} tone="emerald" />
                          )}
                          <Tag
                            icon={
                              item.hookahType === "amy" ? (
                                <Crown className="size-2.5" />
                              ) : undefined
                            }
                            label={
                              item.hookahType === "amy"
                                ? t("wizAmyPipeTag")
                                : t("wizRegularPipeTag")
                            }
                          />
                          {item.components.length > 0 && (
                            <Tag label={item.primaryBrandName} />
                          )}
                          {item.qty > 1 && <Tag label={`× ${item.qty}`} />}
                        </div>
                      </div>
                      <div className="relative text-end">
                        <p className="font-display text-base font-bold tabular-nums text-gold">
                          {egp(charge)}
                        </p>
                        {bogo && (
                          <p className="text-[10px] font-medium text-emerald-300">
                            {t("wizByoBadge")}
                          </p>
                        )}
                      </div>
                      <div className="relative flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChange(false);
                            onEdit(item);
                          }}
                          className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                          aria-label={`${t("wizEditShisha")}: ${item.forName ?? item.primaryBrandName}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(item)}
                          className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                          aria-label={`${t("wizRemoveShisha")}: ${item.forName ?? item.primaryBrandName}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}

          {/* actions */}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onAddAnother();
              }}
              className="glass flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-foreground transition-all duration-300 hover:border-primary/40 hover:text-primary active:scale-[0.98]"
            >
              <Plus className="size-4" />
              {t("wizAddAnother")}
            </button>
            <GoldButton
              size="lg"
              className="min-h-12"
              disabled={items.length === 0}
              onClick={() => {
                onOpenChange(false);
                onSend();
              }}
            >
              <Send className="size-4" />
              {t("wizSendTable")}
            </GoldButton>
          </div>

          {totals.discount > 0 && (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-300">
              <Check className="size-3" />
              {t("wizBogoYou")} · {egp(totals.subtotal)} → {egp(totals.total)}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Tag({
  icon,
  label,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  tone?: "emerald";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-semibold",
        tone === "emerald"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          : "border-white/[0.1] bg-white/[0.05] text-muted-foreground"
      )}
    >
      {icon}
      {label}
    </span>
  );
}

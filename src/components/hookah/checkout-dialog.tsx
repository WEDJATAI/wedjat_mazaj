"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useCart, computeTotals, CartItem } from "@/store/cart";
import { egp } from "@/lib/catalog";
import {
  redeemOptions,
  redeemDiscount,
  tierDef,
  REDEEM_BLOCK_EGP,
  REDEEM_BLOCK,
} from "@/lib/loyalty";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Phone,
  User,
  Hash,
  StickyNote,
  Gift,
  Sparkles,
  CloudUpload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { queueOrder } from "@/lib/offline-queue";
import { useI18n } from "@/store/i18n";
import { celebrate, haptic } from "@/lib/delight";
import { GoldButton } from "./kit/kit";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "employee" | "guest_scan" | "guest_call";
  orderedByName: string;
  employeeId?: string | null;
  defaultCustomer?: string;
  defaultTable?: string;
  /** R46: numeric Wedjat table id (POS link / picker) — the
   * unambiguous check reference. Dropped if the user edits the table
   * text manually (their edit wins, matched by name server-side). */
  defaultTableId?: number | null;
  /** id of a saved favorite mix applied to this order (optional) */
  favoriteMixId?: string | null;
  /** R49: called with the placed order id — lets the guest flow open
   * the live tracking view straight from the confirmation. */
  onOrderPlaced?: (orderId: string) => void;
}

interface PlaceOrderPayload {
  customerName: string;
  phone: string;
  table?: string;
  tableId?: number | null;
  notes?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  bogo: boolean;
  ownType: string | null;
  addons: string[];
  source: string;
  orderedByName: string;
  employeeId?: string | null;
  favoriteMixId?: string | null;
  loyaltyPhone?: string;
  redeemPoints?: number | null;
}

interface LoyaltyLookup {
  id: string;
  name: string;
  points: number;
  lifetimePoints: number;
  tier: string;
}

interface LoyaltySummary {
  memberName: string;
  tier: string;
  pointsEarned: number;
  pointsRedeemed: number;
  discount: number;
  balanceAfter: number;
  isNew: boolean;
}

/** Molten-gold selected chip (Midnight Ember signature). */
const GOLD_FILL =
  "border-transparent bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_10px_26px_-10px_oklch(0.72_0.145_60/0.6)]";

export function CheckoutDialog({
  open,
  onOpenChange,
  source,
  orderedByName,
  employeeId,
  defaultCustomer,
  defaultTable,
  defaultTableId,
  favoriteMixId,
  onOrderPlaced,
}: CheckoutDialogProps) {
  const t = useI18n((s) => s.t);
  const reduced = useReducedMotion();
  const items = useCart((s) => s.items);
  const ownType = useCart((s) => s.ownType);
  const addons = useCart((s) => s.addons);
  const clear = useCart((s) => s.clear);
  const totals = computeTotals(items, ownType);

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [table, setTable] = React.useState("");
  const [tableTouched, setTableTouched] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState<{
    id: string;
    total: number;
    loyalty: LoyaltySummary | null;
    queuedOffline?: boolean;
  } | null>(null);

  // R49 loyalty state
  const [member, setMember] = React.useState<LoyaltyLookup | null>(null);
  const [isNewMember, setIsNewMember] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);
  const [redeem, setRedeem] = React.useState(0);

  // Prefill / reset whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setDone(null);
      setSubmitting(false);
      setName(defaultCustomer ?? "");
      setTable(defaultTable ?? "");
      setTableTouched(false);
      setMember(null);
      setIsNewMember(false);
      setRedeem(0);
    }
  }, [open, defaultCustomer, defaultTable]);

  // Debounced loyalty lookup whenever the phone is long enough.
  React.useEffect(() => {
    const digits = phone.trim();
    if (digits.length < 5) {
      setMember(null);
      setIsNewMember(false);
      setRedeem(0);
      return;
    }
    setLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/loyalty?phone=${encodeURIComponent(digits)}`
        );
        const data = await res.json();
        if (data.ok && data.member) {
          setMember(data.member);
          setIsNewMember(false);
        } else {
          setMember(null);
          setIsNewMember(true);
        }
      } catch {
        setMember(null);
        setIsNewMember(false);
      } finally {
        setLookingUp(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [phone]);

  // Reset redemption if the balance/total no longer allows it.
  const loyaltyDiscount = redeem > 0 ? redeemDiscount(redeem) : 0;
  const finalTotal = Math.max(0, totals.total - loyaltyDiscount);
  const redeemOpts = member
    ? redeemOptions(member.points, totals.total)
    : [];

  // r54: an order needs a name OR a table so staff know where it goes
  // (previously any order could be placed with zero context).
  const valid = name.trim().length > 0 || table.trim().length > 0;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    haptic("light");
    const payload: PlaceOrderPayload = {
      customerName: name.trim(),
      phone: phone.trim(),
      table: table.trim(),
      tableId: tableTouched ? null : (defaultTableId ?? null),
      notes: notes.trim(),
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      bogo: totals.bogo,
      ownType: ownType,
      addons,
      source,
      orderedByName,
      employeeId: employeeId ?? null,
      favoriteMixId: favoriteMixId ?? null,
      loyaltyPhone:
        phone.trim().length >= 5 && (member || isNewMember)
          ? phone.trim()
          : undefined,
      redeemPoints: redeem > 0 ? redeem : null,
    };
    try {
      // Offline (or the network dropped): save the order locally — it
      // replays automatically the moment we're back online.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const item = await queueOrder(
          payload as unknown as Record<string, unknown>,
          `${defaultCustomer ?? "Guest"} · ${egp(finalTotal)}`
        );
        setDone({
          id: item.id,
          total: finalTotal,
          loyalty: null,
          queuedOffline: true,
        });
        clear();
        haptic("success");
        toast.success(t("orderSavedDeviceToast"), {
          description: t("willSyncToast"),
        });
        return;
      }

      let res: Response;
      try {
        res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // network-level failure — queue for the two-way sync
        const item = await queueOrder(
          payload as unknown as Record<string, unknown>,
          `${defaultCustomer ?? "Guest"} · ${egp(finalTotal)}`
        );
        setDone({
          id: item.id,
          total: finalTotal,
          loyalty: null,
          queuedOffline: true,
        });
        clear();
        haptic("success");
        toast.success(t("orderSavedDeviceToast"), {
          description: t("willSyncToast"),
        });
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not place order");
      }
      setDone({
        id: data.order.id,
        total: data.order.total ?? finalTotal,
        loyalty: data.loyalty ?? null,
      });
      clear();
      celebrate("big");
      haptic("success");
      toast.success(t("orderPlaced"), {
        description: t("sessionQueuedToast"),
      });
      onOrderPlaced?.(data.order.id);
    } catch (err) {
      haptic("error");
      toast.error("Could not place order", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => onOpenChange(false);

  const earnPreview = member
    ? Math.floor(finalTotal * (tierDef(member.tier).multiplier ?? 1))
    : isNewMember
    ? Math.floor(finalTotal) + 50
    : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-hidden rounded-2xl border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] p-0 backdrop-blur-2xl sm:max-w-md">
        {done ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            {/* cinematic success — gold check ring draws itself in */}
            <motion.div
              initial={reduced ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className={cn(
                "relative grid size-20 place-items-center rounded-full",
                done.queuedOffline
                  ? "bg-amber-500/15 ring-1 ring-amber-500/30"
                  : "bg-primary/10 ring-1 ring-primary/30"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none absolute inset-0 rounded-full blur-xl",
                  done.queuedOffline ? "bg-amber-500/15" : "bg-primary/15"
                )}
                aria-hidden
              />
              {done.queuedOffline ? (
                <CloudUpload className="relative size-9 text-amber-400" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="relative size-10 text-primary"
                  fill="none"
                  aria-hidden
                >
                  <motion.path
                    d="m5 13 4.2 4.2L19 7.4"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 170,
                      damping: 22,
                      delay: 0.2,
                    }}
                  />
                </svg>
              )}
            </motion.div>
            <div>
              <DialogTitle className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                {done.queuedOffline
                  ? t("orderSavedOfflineTitle")
                  : t("orderPlaced")}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {done.queuedOffline
                  ? t("orderSavedOfflineDesc")
                  : t("sessionQueued")}
              </DialogDescription>
            </div>
            <div className="glass w-full rounded-2xl p-4 text-start text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("orderId")}</span>
                <span className="font-mono font-semibold tracking-wider">
                  {done.id.slice(-6).toUpperCase()}
                </span>
              </div>
              <span className="ember-hairline my-2.5 block w-full" aria-hidden />
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("total")}</span>
                <span className="font-display text-lg font-bold tabular-nums text-gold">
                  {egp(done.total)}
                </span>
              </div>
              {done.loyalty && (
                <>
                  <span
                    className="ember-hairline my-2.5 block w-full"
                    aria-hidden
                  />
                  <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-2 text-start">
                    <span className="text-lg">
                      {tierDef(done.loyalty.tier).emoji}
                    </span>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold">
                        {done.loyalty.isNew
                          ? t("welcomeMazajPlus")
                          : `${done.loyalty.memberName} · ${tierDef(done.loyalty.tier).label}`}
                      </p>
                      <p className="text-muted-foreground">
                        +{done.loyalty.pointsEarned} {t("ptsEarned")}
                        {done.loyalty.pointsRedeemed > 0 &&
                          ` · −${done.loyalty.pointsRedeemed} ${t("ptsRedeemed")} (−${egp(done.loyalty.discount)})`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                      {done.loyalty.balanceAfter} pts
                    </span>
                  </div>
                </>
              )}
            </div>
            <GoldButton className="w-full" onClick={close}>
              {t("done")}
            </GoldButton>
          </div>
        ) : (
          <>
            <DialogHeader className="gap-1 px-6 pt-6">
              <DialogTitle className="font-display text-2xl font-bold tracking-tight text-gold-soft">
                {t("checkout")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {source === "employee"
                  ? `${orderedByName} → ${defaultCustomer ?? "—"}`
                  : `${defaultCustomer ?? "—"}${table ? ` · ${table}` : ""}`}
              </DialogDescription>
            </DialogHeader>

            <div className="slim-scroll max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-2">
              <Field
                label={t("customerNameOptional")}
                icon={<User className="size-3.5" />}
              >
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("customerNameOptional")}
                  aria-label={t("customerName")}
                  className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04]"
                />
              </Field>
              <Field
                label={`${t("phone")} · ${t("loyalty")}`}
                icon={<Phone className="size-3.5" />}
              >
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("loyaltyPhonePlaceholder")}
                  inputMode="tel"
                  aria-label={t("phone")}
                  className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04]"
                />
                {/* Loyalty lookup result */}
                {lookingUp && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />{" "}
                    {t("checkingPlus")}
                  </p>
                )}
                {member && (
                  <div className="glass rounded-xl p-2.5 ring-1 ring-primary/25">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {tierDef(member.tier).emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {member.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {tierDef(member.tier).label} · ×
                          {tierDef(member.tier).multiplier}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                        {member.points} pts
                      </span>
                    </div>
                    {redeemOpts.length > 0 && (
                      <div className="mt-2 border-t border-primary/20 pt-2">
                        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <Gift className="size-3" /> {t("loyalty")} ·{" "}
                          {REDEEM_BLOCK} pts = {egp(REDEEM_BLOCK_EGP)}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {redeemOpts.map((pts) => (
                            <button
                              key={pts}
                              type="button"
                              onClick={() =>
                                setRedeem(redeem === pts ? 0 : pts)
                              }
                              className={cn(
                                "rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-300",
                                redeem === pts
                                  ? GOLD_FILL
                                  : "border-white/[0.08] bg-white/[0.04] hover:border-primary/40 hover:text-primary"
                              )}
                              aria-pressed={redeem === pts}
                            >
                              −{egp(redeemDiscount(pts))} · {pts} pts
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!lookingUp && isNewMember && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5">
                    <Sparkles className="size-4 shrink-0 text-amber-500" />
                    <p className="text-xs text-muted-foreground">
                      {t("newToMazajPlus")} — {t("bonusPtsPrefix")}{" "}
                      {Math.floor(finalTotal)} {t("ptsOnOrder")}
                    </p>
                  </div>
                )}
              </Field>
              <Field label={t("tableRoom")} icon={<Hash className="size-3.5" />}>
                <Input
                  value={table}
                  onChange={(e) => {
                    setTable(e.target.value);
                    setTableTouched(true);
                  }}
                  placeholder={t("tablePlaceholder2")}
                  aria-label={t("tableRoom")}
                  className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04]"
                />
                {!tableTouched && defaultTableId != null && (
                  <p className="text-xs text-primary">{t("posLinkedNote")}</p>
                )}
              </Field>
              <Field
                label={t("notesOptional")}
                icon={<StickyNote className="size-3.5" />}
              >
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                  rows={2}
                  className="resize-none rounded-xl border-white/[0.08] bg-white/[0.04]"
                />
              </Field>

              {!valid && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-500">
                  {t("nameOrTableHint")}
                </p>
              )}

              <div className="glass rounded-2xl p-3.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("subtotal")}</span>
                  <span className="tabular-nums">{egp(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between font-medium text-primary">
                    <span>{t("byoSaving")}</span>
                    <span className="tabular-nums">
                      −{egp(totals.discount)}
                    </span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between font-medium text-primary">
                    <span className="flex items-center gap-1">
                      <Gift className="size-3.5" /> {t("loyalty")}
                    </span>
                    <span className="tabular-nums">
                      −{egp(loyaltyDiscount)}
                    </span>
                  </div>
                )}
                <span className="ember-hairline my-2.5 block w-full" aria-hidden />
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{t("total")}</span>
                  <span className="font-display text-xl font-bold tabular-nums text-gold">
                    {egp(finalTotal)}
                  </span>
                </div>
                {(member || isNewMember) && earnPreview > 0 && (
                  <p className="mt-1 text-end text-[11px] text-muted-foreground">
                    +{earnPreview} {t("ptsOnOrder")}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-white/[0.08] px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <GoldButton
                size="lg"
                className="w-full"
                disabled={!valid || submitting}
                onClick={submit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />{" "}
                    {t("placingOrder")}
                  </>
                ) : (
                  `${t("placeOrder")} · ${egp(finalTotal)}`
                )}
              </GoldButton>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

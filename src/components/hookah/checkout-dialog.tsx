"use client";

import * as React from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
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
  }, [open]);

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

  // Customer name is now optional — the order can be placed with just a table.
  const valid = true;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
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
        toast.success("Order saved on this device", {
          description: "It will sync to the lounge automatically when you reconnect.",
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
        toast.success("Order saved on this device", {
          description: "It will sync to the lounge automatically when you reconnect.",
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
      toast.success("Order placed!", {
        description: "Session added to the queue.",
      });
      onOrderPlaced?.(data.order.id);
    } catch (err) {
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
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-md">
        {done ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <div
              className={cn(
                "grid size-16 place-items-center rounded-full",
                done.queuedOffline
                  ? "bg-amber-500/15"
                  : "bg-primary/15"
              )}
            >
              {done.queuedOffline ? (
                <CloudUpload className="size-9 text-amber-400" />
              ) : (
                <CheckCircle2 className="size-9 text-primary" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl">
                {done.queuedOffline ? "Order saved offline" : "Order placed!"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {done.queuedOffline
                  ? "You're offline — this order will sync to the lounge automatically the moment you reconnect."
                  : "The hookah session is queued for preparation."}
              </DialogDescription>
            </div>
            <div className="w-full rounded-2xl border border-border bg-muted/40 p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono font-semibold">
                  {done.id.slice(-6).toUpperCase()}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-primary">
                  {egp(done.total)}
                </span>
              </div>
              {done.loyalty && (
                <>
                  <Separator className="my-2" />
                  <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-2 text-left">
                    <span className="text-lg">{tierDef(done.loyalty.tier).emoji}</span>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold">
                        {done.loyalty.isNew ? "Welcome to Mazaj+!" : `${done.loyalty.memberName} · ${tierDef(done.loyalty.tier).label}`}
                      </p>
                      <p className="text-muted-foreground">
                        +{done.loyalty.pointsEarned} pts earned
                        {done.loyalty.pointsRedeemed > 0 &&
                          ` · −${done.loyalty.pointsRedeemed} pts redeemed (−${egp(done.loyalty.discount)})`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                      {done.loyalty.balanceAfter} pts
                    </span>
                  </div>
                </>
              )}
            </div>
            <Button className="w-full rounded-xl" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Checkout</DialogTitle>
              <DialogDescription>
                {source === "employee"
                  ? `Placing order as ${orderedByName}`
                  : `Guest order by ${defaultCustomer ?? "guest"}`}
                . Confirm and place.
              </DialogDescription>
            </DialogHeader>

            <div className="slim-scroll max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-2">
              <Field label="Customer name (optional)" icon={<User className="size-3.5" />}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer name (optional)"
                  aria-label="Customer name"
                />
              </Field>
              <Field
                label="Phone (loyalty)"
                icon={<Phone className="size-3.5" />}
              >
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx — earn & redeem points"
                  inputMode="tel"
                  aria-label="Phone for loyalty points"
                />
                {/* Loyalty lookup result */}
                {lookingUp && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Checking Mazaj+…
                  </p>
                )}
                {member && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tierDef(member.tier).emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {member.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {tierDef(member.tier).label} member · ×
                          {tierDef(member.tier).multiplier} earn rate
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                        {member.points} pts
                      </span>
                    </div>
                    {redeemOpts.length > 0 && (
                      <div className="mt-2 border-t border-primary/20 pt-2">
                        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <Gift className="size-3" /> Redeem points (
                          {REDEEM_BLOCK} pts = {egp(REDEEM_BLOCK_EGP)} off)
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
                                "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                                redeem === pts
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card hover:border-primary/50"
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
                      New here? This phone joins <b>Mazaj+</b> automatically —
                      50 bonus pts + {Math.floor(finalTotal)} pts on this
                      order.
                    </p>
                  </div>
                )}
              </Field>
              <Field label="Table / room" icon={<Hash className="size-3.5" />}>
                <Input
                  value={table}
                  onChange={(e) => {
                    setTable(e.target.value);
                    setTableTouched(true);
                  }}
                  placeholder="e.g. Table 7"
                  aria-label="Table"
                />
                {!tableTouched && defaultTableId != null && (
                  <p className="text-xs text-primary">
                    ✓ linked to check of table {table || defaultTableId} (from the restaurant POS)
                  </p>
                )}
              </Field>
              <Field label="Notes (optional)" icon={<StickyNote className="size-3.5" />}>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Extra coal, flavor requests…"
                  rows={2}
                  className="resize-none"
                />
              </Field>

              <div className="rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{egp(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between font-medium text-primary">
                    <span>BYO 2-for-1 saving</span>
                    <span className="tabular-nums">
                      −{egp(totals.discount)}
                    </span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between font-medium text-primary">
                    <span className="flex items-center gap-1">
                      <Gift className="size-3.5" /> Mazaj+ points
                    </span>
                    <span className="tabular-nums">
                      −{egp(loyaltyDiscount)}
                    </span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold tabular-nums">
                    {egp(finalTotal)}
                  </span>
                </div>
                {(member || isNewMember) && earnPreview > 0 && (
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">
                    +{earnPreview} pts on this order
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-border px-6 py-4">
              <Button
                size="lg"
                className="w-full rounded-xl text-base font-semibold"
                disabled={!valid || submitting}
                onClick={submit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Placing order…
                  </>
                ) : (
                  `Place order · ${egp(finalTotal)}`
                )}
              </Button>
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

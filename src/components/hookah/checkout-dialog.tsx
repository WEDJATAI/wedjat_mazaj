"use client";

import * as React from "react";
import { useCart, computeTotals, CartItem } from "@/store/cart";
import { egp } from "@/lib/catalog";
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
} from "lucide-react";
import { toast } from "sonner";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "employee" | "guest_scan" | "guest_call";
  orderedByName: string;
  employeeId?: string | null;
  defaultCustomer?: string;
  defaultTable?: string;
  /** id of a saved favorite mix applied to this order (optional) */
  favoriteMixId?: string | null;
}

interface PlaceOrderPayload {
  customerName: string;
  phone: string;
  table?: string;
  notes?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  bogo: boolean;
  ownType: string | null;
  source: string;
  orderedByName: string;
  employeeId?: string | null;
  favoriteMixId?: string | null;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  source,
  orderedByName,
  employeeId,
  defaultCustomer,
  defaultTable,
  favoriteMixId,
}: CheckoutDialogProps) {
  const items = useCart((s) => s.items);
  const ownType = useCart((s) => s.ownType);
  const clear = useCart((s) => s.clear);
  const totals = computeTotals(items, ownType);

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [table, setTable] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState<{ id: string; total: number } | null>(
    null
  );

  // Prefill / reset whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setDone(null);
      setSubmitting(false);
      setName(defaultCustomer ?? "");
      setTable(defaultTable ?? "");
    }
  }, [open]);

  // Customer name is now optional — the order can be placed with just a table.
  const valid = true;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    const payload: PlaceOrderPayload = {
      customerName: name.trim(),
      phone: phone.trim(),
      table: table.trim(),
      notes: notes.trim(),
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      bogo: totals.bogo,
      ownType: ownType,
      source,
      orderedByName,
      employeeId: employeeId ?? null,
      favoriteMixId: favoriteMixId ?? null,
    };
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not place order");
      }
      setDone({ id: data.order.id, total: totals.total });
      clear();
      toast.success("Order placed!", {
        description: "Session added to the queue.",
      });
    } catch (err) {
      toast.error("Could not place order", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => onOpenChange(false);

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
            <div className="grid size-16 place-items-center rounded-full bg-primary/15">
              <CheckCircle2 className="size-9 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Order placed!</DialogTitle>
              <DialogDescription className="mt-1">
                The hookah session is queued for preparation.
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
              <Field label="Phone (optional)" icon={<Phone className="size-3.5" />}>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  inputMode="tel"
                />
              </Field>
              <Field label="Table / room" icon={<Hash className="size-3.5" />}>
                <Input
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  placeholder="e.g. Table 7"
                  aria-label="Table"
                />
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
                <Separator className="my-2" />
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold tabular-nums">
                    {egp(totals.total)}
                  </span>
                </div>
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
                  `Place order · ${egp(totals.total)}`
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

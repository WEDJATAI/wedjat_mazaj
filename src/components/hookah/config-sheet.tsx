"use client";

import * as React from "react";
import { Brand, egp, FLAVOR_LABELS, FlavorType } from "@/lib/catalog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Check, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { toast } from "sonner";

interface ConfigSheetProps {
  brand: Brand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfigSheet({ brand, open, onOpenChange }: ConfigSheetProps) {
  const addItem = useCart((s) => s.addItem);
  const [flavor, setFlavor] = React.useState<FlavorType>("fruits");
  const [qty, setQty] = React.useState(1);

  // Reset state whenever the selected brand changes.
  React.useEffect(() => {
    if (brand) {
      setFlavor(brand.flavorTypes[0] ?? "fruits");
      setQty(1);
    }
  }, [brand]);

  if (!brand) return null;

  const isFlat = brand.flavorTypes.length === 1 && brand.flavorTypes[0] === "flat";
  const unit =
    flavor === "fruits"
      ? brand.pricing.fruits ?? 0
      : flavor === "fruits-mix"
      ? brand.pricing.fruitsMix ?? 0
      : brand.pricing.flat ?? 0;
  const lineTotal = unit * qty;

  const handleAdd = () => {
    addItem(brand.id, flavor, qty);
    toast.success(`${qty}× ${brand.name} added`, {
      description: `${FLAVOR_LABELS[flavor]} · ${egp(lineTotal)}`,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto w-full max-w-xl rounded-t-3xl border-t border-border p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-muted/60 text-2xl">
              {brand.emoji}
            </span>
            <div>
              <SheetTitle className="text-xl">{brand.name}</SheetTitle>
              <SheetDescription>
                {brand.origin} · 20g molasses per hookah
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="slim-scroll max-h-[60vh] space-y-6 overflow-y-auto px-5 pb-4">
          {/* Flavor type */}
          {!isFlat && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Flavor type</p>
              <div className="grid grid-cols-2 gap-2">
                {(["fruits", "fruits-mix"] as FlavorType[]).map((f) => {
                  const active = flavor === f;
                  const price =
                    f === "fruits"
                      ? brand.pricing.fruits ?? 0
                      : brand.pricing.fruitsMix ?? 0;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFlavor(f)}
                      className={cn(
                        "relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                        active
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className="font-medium">{FLAVOR_LABELS[f]}</span>
                        {active && (
                          <Check className="size-4 text-primary" />
                        )}
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        {egp(price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isFlat && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <FlaskConical className="size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Standard session</p>
                <p className="text-xs text-muted-foreground">
                  Flat price, 20g molasses · {egp(brand.pricing.flat ?? 0)}
                </p>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Quantity</p>
              <p className="text-xs text-muted-foreground">
                {qty} × 20g = {qty * 20}g total
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" />
              </Button>
              <span className="min-w-12 text-center text-2xl font-bold tabular-nums">
                {qty}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                aria-label="Increase quantity"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-background/80 px-5 pb-5 pt-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Line total</span>
            <span className="text-lg font-bold">{egp(lineTotal)}</span>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full rounded-xl text-base font-semibold"
            onClick={handleAdd}
          >
            Add to cart · {egp(lineTotal)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

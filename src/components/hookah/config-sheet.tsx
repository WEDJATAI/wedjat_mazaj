"use client";

import * as React from "react";
import {
  Brand,
  egp,
  FLAVOR_LABELS,
  FlavorType,
  getBrand,
  MIXABLE_BRANDS,
  MOLASSES_GRAMS,
} from "@/lib/catalog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Minus,
  Plus,
  Check,
  X,
  Shuffle,
  Leaf,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCart,
  FlavorComponent,
  priceForConfig,
  splitGrams,
} from "@/store/cart";
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
  const [singleFlavor, setSingleFlavor] = React.useState<string>("");
  const [mixComponents, setMixComponents] = React.useState<FlavorComponent[]>([]);

  // Reset state whenever the selected brand changes.
  React.useEffect(() => {
    if (brand) {
      setFlavor(brand.flavorTypes[0] ?? "fruits");
      setQty(1);
      setSingleFlavor(brand.flavors[0] ?? "");
      setMixComponents([]);
    }
  }, [brand]);

  if (!brand) return null;

  const isFlat = brand.flavorTypes.length === 1 && brand.flavorTypes[0] === "flat";

  // Compute grams split for mix display
  const mixGrams = splitGrams(Math.max(1, mixComponents.length));

  const unitPrice = isFlat
    ? brand.pricing.flat ?? 0
    : flavor === "fruits"
    ? brand.pricing.fruits ?? 0
    : priceForConfig("fruits-mix", mixComponents);

  const canAdd = isFlat
    ? true
    : flavor === "fruits"
    ? !!singleFlavor
    : mixComponents.length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    let components: FlavorComponent[] = [];
    if (isFlat) {
      components = [
        {
          brandId: brand.id,
          brandName: brand.name,
          flavorName: singleFlavor || brand.flavors[0],
          emoji: brand.emoji,
          grams: MOLASSES_GRAMS,
        },
      ];
    } else if (flavor === "fruits") {
      components = [
        {
          brandId: brand.id,
          brandName: brand.name,
          flavorName: singleFlavor,
          emoji: brand.emoji,
          grams: MOLASSES_GRAMS,
        },
      ];
    } else {
      // mix: distribute 20g across components
      const grams = splitGrams(mixComponents.length);
      components = mixComponents.map((c, i) => ({ ...c, grams: grams[i] }));
    }

    addItem({
      primaryBrandId: brand.id,
      primaryBrandName: brand.name,
      emoji: brand.emoji,
      accent: brand.accent,
      flavor,
      flavorLabel: FLAVOR_LABELS[flavor],
      components,
      molassesGrams: MOLASSES_GRAMS,
      unitPrice,
      qty,
    });

    const summary =
      components.length === 1
        ? `${brand.name} · ${components[0].flavorName}`
        : `${components.length} flavors · ${egp(unitPrice)}`;
    toast.success(`${qty}× ${brand.name} added`, { description: summary });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-border p-0"
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

        <div className="space-y-6 px-5 pb-4">
          {/* Flavor type selector */}
          {!isFlat && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Type</p>
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
                        "relative flex items-center gap-2 rounded-xl border p-3 text-left transition-all",
                        active
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      {f === "fruits" ? (
                        <Leaf className="size-4 text-primary" />
                      ) : (
                        <Shuffle className="size-4 text-primary" />
                      )}
                      <span className="flex-1">
                        <span className="block font-medium">
                          {FLAVOR_LABELS[f]}
                        </span>
                        <span className="text-xs font-semibold text-primary">
                          {egp(price)}
                        </span>
                      </span>
                      {active && <Check className="size-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Flat note */}
          {isFlat && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <FlaskConical className="size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Standard session</p>
                <p className="text-xs text-muted-foreground">
                  Flat price {egp(brand.pricing.flat ?? 0)} · 20g molasses
                </p>
              </div>
            </div>
          )}

          {/* Flavor picker */}
          {!isFlat && flavor === "fruits" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Pick a flavor
              </p>
              <div className="flex flex-wrap gap-2">
                {brand.flavors.map((f) => {
                  const active = singleFlavor === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSingleFlavor(f)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-all",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mix picker: choose flavors across brands */}
          {!isFlat && flavor === "fruits-mix" && (
            <MixPicker
              baseBrand={brand}
              components={mixComponents}
              grams={mixGrams}
              onChange={setMixComponents}
            />
          )}

          {!isFlat && flavor === "flat" && (
            <div className="flex flex-wrap gap-2">
              {brand.flavors.map((f) => {
                const active = singleFlavor === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSingleFlavor(f)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-all",
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    {f}
                  </button>
                );
              })}
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
            <span className="text-lg font-bold">
              {egp(unitPrice * qty)}
            </span>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full rounded-xl text-base font-semibold"
            onClick={handleAdd}
            disabled={!canAdd}
          >
            Add to cart · {egp(unitPrice * qty)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MixPicker({
  baseBrand,
  components,
  grams,
  onChange,
}: {
  baseBrand: Brand;
  components: FlavorComponent[];
  grams: number[];
  onChange: (c: FlavorComponent[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const remove = (idx: number) => {
    onChange(components.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Mix flavors{" "}
          <span className="text-muted-foreground">
            ({components.length} selected)
          </span>
        </p>
        <Badge variant="secondary" className="bg-primary/15 text-primary">
          <Shuffle className="mr-1 size-3" /> mix & match
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Combine flavors from {baseBrand.name} or any other brand. The 20g is
        split evenly; price is the highest mix price among chosen brands.
      </p>

      {/* Selected components */}
      {components.length > 0 ? (
        <ul className="space-y-1.5">
          {components.map((c, i) => (
            <li
              key={`${c.brandId}:${c.flavorName}:${i}`}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
            >
              <span className="text-lg">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.brandName} · {c.flavorName}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {grams[i]?.toFixed(2)}g
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove flavor"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          No flavors yet. Tap “Add a flavor” to start your mix.
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full rounded-xl"
        onClick={() => setPickerOpen(true)}
      >
        <Plus className="size-4" /> Add a flavor
      </Button>

      {pickerOpen && (
        <FlavorPicker
          baseBrand={baseBrand}
          onPick={(brandId, flavorName) => {
            const b = getBrand(brandId);
            if (!b) return;
            // avoid duplicates of the same brand+flavor
            const exists = components.some(
              (c) => c.brandId === brandId && c.flavorName === flavorName
            );
            if (exists) {
              toast.error("Flavor already added");
              return;
            }
            onChange([
              ...components,
              {
                brandId,
                brandName: b.name,
                flavorName,
                emoji: b.emoji,
                grams: 0,
              },
            ]);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function FlavorPicker({
  baseBrand,
  onPick,
  onClose,
}: {
  baseBrand: Brand;
  onPick: (brandId: string, flavorName: string) => void;
  onClose: () => void;
}) {
  const [activeBrand, setActiveBrand] = React.useState(baseBrand.id);
  const brand = getBrand(activeBrand) ?? baseBrand;

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      {/* brand tabs */}
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {MIXABLE_BRANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setActiveBrand(b.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all",
              activeBrand === b.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-background hover:border-primary/50"
            )}
          >
            <span>{b.emoji}</span>
            {b.name}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        {brand.name} flavors:
      </p>
      <div className="flex flex-wrap gap-2">
        {brand.flavors.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onPick(brand.id, f)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
          >
            {f}
          </button>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-3 w-full text-sm"
        onClick={onClose}
      >
        Close
      </Button>
    </div>
  );
}

"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
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
import { useI18n } from "@/store/i18n";
import { toast } from "sonner";
import { haptic } from "@/lib/delight";
import { FadeSwap, GoldButton, Kicker, Stagger, StaggerItem } from "./kit/kit";

/** Flavors marked as popular (⭐) to guide first-time guests. */
const POPULAR_FLAVORS = new Set([
  "Double Apple",
  "Mint",
  "Grape",
  "Blueberry",
  "Watermelon",
]);

/** Molten-gold selected pill (Midnight Ember signature). */
const GOLD_FILL =
  "border-transparent bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_10px_26px_-10px_oklch(0.72_0.145_60/0.6)]";

const GLASS_PILL =
  "border-white/[0.08] bg-white/[0.04] text-foreground hover:border-primary/40 hover:bg-white/[0.07] hover:text-primary";

interface ConfigSheetProps {
  brand: Brand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfigSheet({ brand, open, onOpenChange }: ConfigSheetProps) {
  const t = useI18n((s) => s.t);
  const reduced = useReducedMotion();
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

    haptic("light");
    const summary =
      components.length === 1
        ? `${brand.name} · ${components[0].flavorName}`
        : `${components.length} ${t("flavors")} · ${egp(unitPrice)}`;
    toast.success(`${qty}× ${brand.name} — ${t("addedToCart")}`, {
      description: summary,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] p-0 backdrop-blur-2xl"
      >
        {/* ── cinematic header: grab handle + kicker + display brand title ── */}
        <SheetHeader className="gap-2.5 px-5 pb-3 pt-3">
          <div
            className="mx-auto h-1 w-10 rounded-full bg-white/15"
            aria-hidden
          />
          <div className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-2xl ring-1 ring-primary/25">
              {brand.emoji}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-gold-soft">
                {brand.origin}
              </p>
              <SheetTitle className="font-display -mt-0.5 text-2xl font-bold tracking-tight text-gold-soft">
                {brand.name}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs">
                {t("grams20Note")}
              </SheetDescription>
            </div>
          </div>
          <span className="ember-hairline w-full" aria-hidden />
        </SheetHeader>

        <Stagger className="space-y-6 px-5 pb-4">
          {/* Flavor type selector */}
          {!isFlat && (
            <StaggerItem className="space-y-2.5">
              <Kicker>{t("type")}</Kicker>
              <div className="grid grid-cols-2 gap-2">
                {(["fruits", "fruits-mix"] as FlavorType[]).map((f) => {
                  const active = flavor === f;
                  const price =
                    f === "fruits"
                      ? brand.pricing.fruits ?? 0
                      : brand.pricing.fruitsMix ?? 0;
                  return (
                    <motion.button
                      key={f}
                      type="button"
                      whileTap={reduced ? undefined : { scale: 0.97 }}
                      onClick={() => setFlavor(f)}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-2xl border p-3 text-start transition-all duration-300",
                        active
                          ? "border-primary/40 bg-primary/10 ring-1 ring-primary/40"
                          : "border-white/[0.08] bg-white/[0.04] hover:border-primary/40 hover:bg-white/[0.06]"
                      )}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                        {f === "fruits" ? (
                          <Leaf className="size-4" />
                        ) : (
                          <Shuffle className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {FLAVOR_LABELS[f]}
                        </span>
                        <span className="font-display block text-sm font-bold tabular-nums text-gold">
                          {egp(price)}
                        </span>
                      </span>
                      {active && <Check className="size-4 shrink-0 text-primary" />}
                    </motion.button>
                  );
                })}
              </div>
            </StaggerItem>
          )}

          {/* Flat note */}
          {isFlat && (
            <StaggerItem>
              <div className="glass flex items-center gap-3 rounded-2xl p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                  <FlaskConical className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t("standardSession")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("flatNote")}{" "}
                    <span className="font-display font-bold tabular-nums text-gold">
                      {egp(brand.pricing.flat ?? 0)}
                    </span>{" "}
                    · 20g
                  </p>
                </div>
              </div>
            </StaggerItem>
          )}

          {/* Flavor picker / mix picker — crossfades between modes */}
          {!isFlat && (
            <StaggerItem>
              <FadeSwap swapKey={flavor}>
                {flavor === "fruits" ? (
                  <div className="space-y-2.5">
                    <Kicker>{t("pickFlavor")}</Kicker>
                    <div className="flex flex-wrap gap-2">
                      {brand.flavors.map((f) => {
                        const active = singleFlavor === f;
                        const popular = POPULAR_FLAVORS.has(f);
                        return (
                          <motion.button
                            key={f}
                            type="button"
                            whileTap={reduced ? undefined : { scale: 0.94 }}
                            onClick={() => setSingleFlavor(f)}
                            className={cn(
                              "relative rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300",
                              active
                                ? GOLD_FILL + " font-semibold"
                                : GLASS_PILL
                            )}
                          >
                            {f}
                            {popular && (
                              <span className="absolute -top-1.5 -end-1.5 text-[10px]">
                                ⭐
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ) : flavor === "fruits-mix" ? (
                  <MixPicker
                    baseBrand={brand}
                    components={mixComponents}
                    grams={mixGrams}
                    onChange={setMixComponents}
                  />
                ) : (
                  <div className="space-y-2.5">
                    <Kicker>{t("pickFlavor")}</Kicker>
                    <div className="flex flex-wrap gap-2">
                      {brand.flavors.map((f) => {
                        const active = singleFlavor === f;
                        return (
                          <motion.button
                            key={f}
                            type="button"
                            whileTap={reduced ? undefined : { scale: 0.94 }}
                            onClick={() => setSingleFlavor(f)}
                            className={cn(
                              "relative rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300",
                              active
                                ? GOLD_FILL + " font-semibold"
                                : GLASS_PILL
                            )}
                          >
                            {f}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </FadeSwap>
            </StaggerItem>
          )}

          {/* Quantity */}
          <StaggerItem className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <Kicker>{t("quantity")}</Kicker>
              <p className="text-xs tabular-nums text-muted-foreground">
                {qty} × 20g = {qty * 20}g total
              </p>
            </div>
            <div className="glass flex items-center justify-between rounded-2xl p-2">
              <GoldButton
                aria-label="Decrease quantity"
                className="size-11 p-0"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
              >
                <Minus className="size-4" />
              </GoldButton>
              <span className="font-display min-w-12 text-center text-2xl font-bold tabular-nums text-gold">
                {qty}
              </span>
              <GoldButton
                aria-label="Increase quantity"
                className="size-11 p-0"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
              >
                <Plus className="size-4" />
              </GoldButton>
            </div>
          </StaggerItem>
        </Stagger>

        {/* ── sticky footer: live price + gold CTA ── */}
        <div className="sticky bottom-0 z-10 border-t border-white/[0.08] bg-[oklch(0.175_0.015_60/0.95)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-2xl">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {t("lineTotal")}
            </span>
            <span className="font-display text-2xl font-bold tabular-nums text-gold">
              {egp(unitPrice * qty)}
            </span>
          </div>
          <GoldButton
            size="lg"
            className="w-full"
            onClick={handleAdd}
            disabled={!canAdd}
          >
            {t("addToCart")} · {egp(unitPrice * qty)}
          </GoldButton>
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
  const t = useI18n((s) => s.t);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const remove = (idx: number) => {
    onChange(components.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {t("mixFlavors")}{" "}
          <span className="text-muted-foreground">
            ({components.length} {t("selectedWord")})
          </span>
        </p>
        <Badge
          variant="secondary"
          className="border-primary/30 bg-primary/15 text-primary"
        >
          <Shuffle className="size-3" /> {t("mixMatch")}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">{t("mixAcrossBrands")}</p>

      {/* Selected components */}
      {components.length > 0 ? (
        <ul className="space-y-1.5">
          {components.map((c, i) => (
            <li
              key={`${c.brandId}:${c.flavorName}:${i}`}
              className="glass flex items-center gap-2.5 rounded-xl px-3 py-1.5"
            >
              <span className="text-lg">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.brandName} · {c.flavorName}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {grams[i]?.toFixed(2)}g
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                aria-label="Remove flavor"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-sm text-muted-foreground">
          {t("mixEmpty")}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm font-medium text-foreground transition-all duration-300 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
      >
        <Plus className="size-4" /> {t("addFlavor")}
      </button>

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
  const t = useI18n((s) => s.t);
  const [activeBrand, setActiveBrand] = React.useState(baseBrand.id);
  const brand = getBrand(activeBrand) ?? baseBrand;

  return (
    <div className="glass rounded-2xl p-3">
      {/* brand tabs */}
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {MIXABLE_BRANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setActiveBrand(b.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-all duration-300",
              activeBrand === b.id
                ? "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/40"
                : "border-white/[0.08] bg-white/[0.04] hover:border-primary/40 hover:text-primary"
            )}
          >
            <span>{b.emoji}</span>
            {b.name}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        {brand.name} {t("flavorsOf")}
      </p>
      <div className="flex flex-wrap gap-2">
        {brand.flavors.map((f) => {
          const popular = POPULAR_FLAVORS.has(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => onPick(brand.id, f)}
              className={cn(
                "relative rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300",
                GLASS_PILL
              )}
            >
              {f}
              {popular && (
                <span className="absolute -top-1.5 -end-1.5 text-[10px]">⭐</span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("closeBtn")}
      </button>
    </div>
  );
}

"use client";

import * as React from "react";
import { useCart, FlavorComponent } from "@/store/cart";
import { egp, mixPrice, MOLASSES_GRAMS, splitGrams } from "@/lib/catalog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/store/i18n";
import { toast } from "sonner";
import {
  EmptyState,
  GoldButton,
  SheetGrip,
  Stagger,
  StaggerItem,
} from "./kit/kit";

export interface FavoriteMix {
  id: string;
  guestName: string;
  label: string;
  componentsJson: string;
  createdAt: string;
}

function parsedComponents(json: string): FlavorComponent[] {
  try {
    return JSON.parse(json) as FlavorComponent[];
  } catch {
    return [];
  }
}

interface FavoritesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestName: string;
}

export function FavoritesSheet({ open, onOpenChange, guestName }: FavoritesSheetProps) {
  const t = useI18n((s) => s.t);
  const addItem = useCart((s) => s.addItem);
  const items = useCart((s) => s.items);
  const [favorites, setFavorites] = React.useState<FavoriteMix[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [savingLabel, setSavingLabel] = React.useState(false);
  const [label, setLabel] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/favorites?guestName=${encodeURIComponent(guestName)}`);
      const data = await res.json();
      if (data.ok) setFavorites(data.favorites);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [guestName]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Can only save a mix as a favorite if the cart has a fruits-mix item.
  const firstMix = items.find((i) => i.flavor === "fruits-mix" && i.components.length > 0);
  const canSave = !!firstMix;

  const saveFavorite = async () => {
    if (!canSave || !label.trim()) return;
    setSavingLabel(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          label: label.trim(),
          components: firstMix!.components,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not save");
      toast.success("Favorite saved!", {
        description: label.trim(),
      });
      setLabel("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save favorite");
    } finally {
      setSavingLabel(false);
    }
  };

  const applyFavorite = (fav: FavoriteMix) => {
    const comps = parsedComponents(fav.componentsJson);
    if (comps.length === 0) {
      toast.error("This favorite has no flavors");
      return;
    }
    const unit = mixPrice(comps.map((c) => c.brandId));
    addItem({
      primaryBrandId: comps[0].brandId,
      primaryBrandName: comps[0].brandName,
      emoji: comps[0].emoji,
      accent: "from-rose-500/25 to-amber-500/5",
      flavor: "fruits-mix",
      flavorLabel: "Fruits Mix",
      components: comps,
      molassesGrams: MOLASSES_GRAMS,
      unitPrice: unit,
      qty: 1,
    });
    toast.success(`${t("favAdded")} "${fav.label}"`, {
      description: `${comps.length} ${t("flavors")} · ${egp(unit)}`,
    });
    onOpenChange(false);
  };

  const deleteFavorite = async (id: string) => {
    try {
      const res = await fetch(`/api/favorites/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      toast.success(t("favRemoved"));
      setFavorites((f) => f.filter((x) => x.id !== id));
    } catch {
      toast.error("Could not delete favorite");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[oklch(0.175_0.015_60/0.92)] p-0 backdrop-blur-2xl"
      >
        <SheetHeader className="px-5 pb-1 pt-2">
          <SheetGrip />
          <SheetTitle className="font-display text-center text-2xl font-bold tracking-tight text-gold-soft">
            {t("favTitle")}
          </SheetTitle>
          <SheetDescription className="text-center text-xs">
            {t("favDesc")}, {guestName}.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 pb-8 pt-3">
          {/* Save current mix */}
          <div className="glass relative overflow-hidden rounded-2xl p-3.5">
            <div
              className="pointer-events-none absolute -end-8 -top-10 size-28 rounded-full bg-primary/15 opacity-50 blur-3xl"
              aria-hidden
            />
            <p className="relative mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> {t("saveCurrentMix")}
            </p>
            {canSave ? (
              <div className="relative flex gap-2">
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t("favPlaceholder")}
                  aria-label="Favorite name"
                  className="h-11 flex-1 rounded-full border-white/[0.09] bg-white/[0.04] px-4 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && saveFavorite()}
                />
                <GoldButton
                  onClick={saveFavorite}
                  disabled={!label.trim() || savingLabel}
                  className="shrink-0"
                >
                  {savingLabel ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="size-4" /> {t("saveBtn")}
                    </>
                  )}
                </GoldButton>
              </div>
            ) : (
              <p className="relative text-xs text-muted-foreground">
                {t("favHint")}
              </p>
            )}
          </div>

          {/* Saved list */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.05]" />
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <EmptyState
              icon={<Heart className="size-6" />}
              title={t("noFavs")}
            />
          ) : (
            <Stagger className="space-y-2">
              {favorites.map((fav) => {
                const comps = parsedComponents(fav.componentsJson);
                const unit = mixPrice(comps.map((c) => c.brandId));
                return (
                  <StaggerItem key={fav.id}>
                    <div className="glass group flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-primary/25 to-primary/[0.06] text-primary ring-1 ring-primary/25">
                        <Heart className="size-5 fill-current" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display truncate text-base font-bold tracking-tight text-gold-soft">
                          {fav.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {comps.map((c) => `${c.brandName} ${c.flavorName}`).join(" + ")}
                        </p>
                        <p className="font-display mt-0.5 text-xs font-bold tabular-nums text-gold">
                          {egp(unit)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <GoldButton size="sm" onClick={() => applyFavorite(fav)}>
                          {t("addBtn")}
                        </GoldButton>
                        <button
                          type="button"
                          onClick={() => deleteFavorite(fav.id)}
                          className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${fav.label}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

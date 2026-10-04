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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  Plus,
  Trash2,
  Star,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
    toast.success(`Added "${fav.label}"`, {
      description: `${comps.length} flavors · ${egp(unit)}`,
    });
    onOpenChange(false);
  };

  const deleteFavorite = async (id: string) => {
    try {
      const res = await fetch(`/api/favorites/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      toast.success("Favorite removed");
      setFavorites((f) => f.filter((x) => x.id !== id));
    } catch {
      toast.error("Could not delete favorite");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="slim-scroll mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-border p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Heart className="size-5 text-primary" /> Your favorite mixes
          </SheetTitle>
          <SheetDescription>
            Save your go-to bowl and re-order it in one tap, {guestName}.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 pb-5">
          {/* Save current mix */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> Save your current mix
            </p>
            {canSave ? (
              <div className="flex gap-2">
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. My Blueberry Mint"
                  aria-label="Favorite name"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && saveFavorite()}
                />
                <Button
                  onClick={saveFavorite}
                  disabled={!label.trim() || savingLabel}
                  className="rounded-xl"
                >
                  {savingLabel ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="size-4" /> Save
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add a <span className="font-medium text-foreground">Fruits Mix</span>{" "}
                to your cart first, then save it here.
              </p>
            )}
          </div>

          {/* Saved list */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No favorites yet. Save your first mix above.
            </div>
          ) : (
            <ul className="space-y-2">
              {favorites.map((fav) => {
                const comps = parsedComponents(fav.componentsJson);
                const unit = mixPrice(comps.map((c) => c.brandId));
                return (
                  <li
                    key={fav.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Star className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{fav.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {comps.map((c) => `${c.brandName} ${c.flavorName}`).join(" + ")}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-primary">
                        {egp(unit)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        className="rounded-lg"
                        onClick={() => applyFavorite(fav)}
                      >
                        Add
                      </Button>
                      <button
                        type="button"
                        onClick={() => deleteFavorite(fav.id)}
                        className="grid place-items-center rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Delete ${fav.label}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

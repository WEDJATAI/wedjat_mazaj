"use client";

import { Brand, egp } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BrandCardProps {
  brand: Brand;
  inCart: number;
  onSelect: () => void;
}

export function BrandCard({ brand, inCart, onSelect }: BrandCardProps) {
  const fromPrice =
    brand.pricing.flat ??
    brand.pricing.fruits ??
    brand.pricing.fruitsMix ??
    0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-all",
        "hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        brand.ring
      )}
    >
      {/* accent glow */}
      <div
        className={cn(
          "pointer-events-none absolute -top-10 right-0 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl opacity-70 transition-opacity group-hover:opacity-100",
          brand.accent
        )}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-muted/60 text-xl">
            {brand.emoji}
          </span>
          <div>
            <h3 className="font-semibold leading-tight">{brand.name}</h3>
            <p className="text-xs text-muted-foreground">{brand.origin}</p>
          </div>
        </div>
        {brand.badge && (
          <Badge
            variant="secondary"
            className="shrink-0 border border-primary/30 bg-primary/15 text-primary"
          >
            {brand.badge}
          </Badge>
        )}
      </div>

      <p className="relative mt-3 line-clamp-2 text-sm text-muted-foreground">
        {brand.blurb}
      </p>

      <div className="relative mt-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            From
          </p>
          <p className="text-lg font-bold text-foreground">
            {egp(fromPrice)}
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm font-medium text-primary">
          {inCart > 0 ? (
            <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
              {inCart} in cart
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground group-hover:text-primary">
              Configure
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-2 flex flex-wrap gap-1.5">
        {brand.flavorTypes.includes("fruits") && (
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            Fruits · {egp(brand.pricing.fruits ?? 0)}
          </span>
        )}
        {brand.flavorTypes.includes("fruits-mix") && (
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            Mix · {egp(brand.pricing.fruitsMix ?? 0)}
          </span>
        )}
        {brand.flavorTypes.includes("flat") && (
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            20g · flat
          </span>
        )}
      </div>
    </button>
  );
}

"use client";

import { Brand, egp, brandColor } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

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
  const color = brandColor(brand.id);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-card p-4 text-left transition-all",
        "hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      )}
      style={{ borderColor: `${color}40` }}
    >
      {/* brand-colored accent glow */}
      <div
        className="pointer-events-none absolute -top-12 -right-8 size-32 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60"
        style={{ backgroundColor: color }}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-12 place-items-center rounded-2xl text-2xl ring-1"
            style={{ backgroundColor: `${color}22`, boxShadow: `0 0 0 1px ${color}40` }}
          >
            {brand.emoji}
          </span>
          <div>
            <h3 className="font-bold leading-tight">{brand.name}</h3>
            <p className="text-[11px] text-muted-foreground">{brand.origin}</p>
          </div>
        </div>
        {brand.badge && (
          <Badge
            variant="secondary"
            className="shrink-0 border text-[10px]"
            style={{ borderColor: `${color}60`, backgroundColor: `${color}20`, color }}
          >
            {brand.badge}
          </Badge>
        )}
      </div>

      <p className="relative mt-2.5 line-clamp-1 text-sm text-muted-foreground">
        {brand.blurb}
      </p>

      <div className="relative mt-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            From
          </p>
          <p className="text-xl font-bold" style={{ color }}>
            {egp(fromPrice)}
          </p>
        </div>
        {inCart > 0 ? (
          <span
            className="grid size-8 place-items-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {inCart}
          </span>
        ) : (
          <span
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white opacity-80 transition-opacity group-hover:opacity-100"
            style={{ backgroundColor: color }}
          >
            <Plus className="size-3" /> Build
          </span>
        )}
      </div>

      {/* flavor type chips */}
      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {brand.flavorTypes.includes("fruits") && (
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            Fruits · {egp(brand.pricing.fruits ?? 0)}
          </span>
        )}
        {brand.flavorTypes.includes("fruits-mix") && (
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            Mix · {egp(brand.pricing.fruitsMix ?? 0)}
          </span>
        )}
        {brand.flavorTypes.includes("flat") && (
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            20g · flat
          </span>
        )}
      </div>
    </motion.button>
  );
}

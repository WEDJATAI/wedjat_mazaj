"use client";

import { Brand, egp, brandColor } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { EASE } from "./kit/kit";

interface BrandCardProps {
  brand: Brand;
  inCart: number;
  onSelect: () => void;
  /** position in the grid — drives the staggered entrance */
  index?: number;
}

export function BrandCard({ brand, inCart, onSelect, index = 0 }: BrandCardProps) {
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
      initial={{ opacity: 0, y: 22, filter: "blur(5px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.06, 0.42), ease: EASE }}
      whileTap={{ scale: 0.975 }}
      className={cn(
        "group glass relative flex w-full flex-col overflow-hidden rounded-2xl p-4 text-start",
        "transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_20px_48px_-20px_rgba(0,0,0,0.85)]",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      )}
    >
      {/* brand-colored accent glow — blooms on hover */}
      <div
        className="pointer-events-none absolute -top-14 -end-10 size-36 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {/* gold hairline crown — the mazaj signature */}
      <span
        className="ember-hairline absolute inset-x-4 top-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/95 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
            style={{ boxShadow: `0 0 0 1px ${color}40` }}
          >
            <img
              src={brand.logo}
              alt={`${brand.name} logo`}
              className="h-full w-full object-contain p-1"
              loading="lazy"
            />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold leading-tight text-gold-soft">
              {brand.name}
            </h3>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {brand.origin}
            </p>
          </div>
        </div>
        {brand.badge && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{
              border: `1px solid ${color}60`,
              backgroundColor: `${color}20`,
              color,
            }}
          >
            {brand.badge}
          </span>
        )}
      </div>

      <p className="relative mt-2.5 line-clamp-1 text-sm text-muted-foreground">
        {brand.blurb}
      </p>

      <div className="relative mt-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            From
          </p>
          <p className="font-display text-2xl font-bold" style={{ color }}>
            {egp(fromPrice)}
          </p>
        </div>
        {inCart > 0 ? (
          <span
            className="grid size-8 place-items-center rounded-full bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-xs font-bold text-[oklch(0.17_0.03_50)] shadow-lg"
          >
            {inCart}
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full border border-primary/35 bg-primary/[0.12] px-3.5 py-2 text-xs font-semibold text-primary transition-all group-hover:border-primary/60 group-hover:bg-primary/20">
            <Plus className="size-3" /> Build
          </span>
        )}
      </div>

      {/* flavor type chips */}
      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {brand.flavorTypes.includes("fruits") && (
          <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-muted-foreground">
            Fruits · {egp(brand.pricing.fruits ?? 0)}
          </span>
        )}
        {brand.flavorTypes.includes("fruits-mix") && (
          <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-muted-foreground">
            Mix · {egp(brand.pricing.fruitsMix ?? 0)}
          </span>
        )}
        {brand.flavorTypes.includes("flat") && (
          <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-muted-foreground">
            20g · flat
          </span>
        )}
      </div>
    </motion.button>
  );
}

import { getBrand, brandColor } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * BrandMark — the single canonical way to render a molasses brand's logo
 * anywhere in the app (r59). Every brand image in /public/images/brands is a
 * normalized 512×512 white-backed square, so marks render consistently on the
 * dark lounge theme: a light rounded chip, the logo contained inside, and the
 * brand's signature color as a hairline ring.
 *
 * Presentational only (no hooks) — usable from both server and client trees.
 */

export type BrandMarkSize = "xs" | "sm" | "md" | "lg" | "xl";

const CHIP: Record<BrandMarkSize, string> = {
  xs: "size-6 rounded-[7px] p-[2.5px]",
  sm: "size-8 rounded-lg p-1",
  md: "size-10 rounded-xl p-1",
  lg: "size-14 rounded-2xl p-1.5",
  xl: "size-16 rounded-2xl p-1.5",
};

interface BrandMarkProps {
  /** catalog brandId, e.g. "mazaya" */
  brandId: string;
  size?: BrandMarkSize;
  className?: string;
  /** hide the brand-colored hairline ring (for stacked marks) */
  noRing?: boolean;
}

export function BrandMark({
  brandId,
  size = "md",
  className,
  noRing = false,
}: BrandMarkProps) {
  const brand = getBrand(brandId);
  if (!brand) return null;
  const color = brandColor(brandId);
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden bg-white/95 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.65)]",
        CHIP[size],
        className
      )}
      style={noRing ? undefined : { boxShadow: `0 0 0 1px ${color}55` }}
      aria-hidden
    >
      <img
        src={brand.logo}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </span>
  );
}

/**
 * BrandStack — overlapping brand marks for multi-brand mixes (a bowl that
 * blends e.g. Mazaya + Al Fakher). Shows up to `max` marks plus a "+N" chip.
 */
export function BrandStack({
  brandIds,
  size = "xs",
  max = 3,
  className,
}: {
  brandIds: string[];
  size?: BrandMarkSize;
  max?: number;
  className?: string;
}) {
  const unique = [...new Set(brandIds)].filter((id) => getBrand(id));
  if (unique.length === 0) return null;
  const shown = unique.slice(0, max);
  const rest = unique.length - shown.length;
  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      aria-hidden
    >
      {shown.map((id, i) => (
        <span
          key={id}
          className={cn("relative", i > 0 && "-ms-1.5")}
          style={{ zIndex: shown.length - i }}
        >
          <BrandMark brandId={id} size={size} noRing />
          {/* hairline separation so overlaps read cleanly on dark glass */}
          <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-black/35" />
        </span>
      ))}
      {rest > 0 && (
        <span className="relative -ms-1.5 grid size-6 place-items-center rounded-[7px] bg-white/10 text-[9px] font-bold text-foreground/85 ring-1 ring-white/15">
          +{rest}
        </span>
      )}
    </span>
  );
}

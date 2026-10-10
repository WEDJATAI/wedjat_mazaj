"use client";

/**
 * ─────────────────────────────────────────────────────────────────
 *  MIDNIGHT EMBER — the cinematic app kit
 * ─────────────────────────────────────────────────────────────────
 *  The design language of the r55 landing, distilled into reusable
 *  primitives for every app screen (sign-in, order, staff panels,
 *  sheets). Import from here instead of hand-rolling chrome:
 *
 *    ScreenShell   — page wrapper: ember glow + grain + vignette
 *    AppHeader     — glass top bar with display wordmark, hairline
 *    Kicker        — gold section label with hairlines
 *    CineCard      — glass card, lifts on hover, gold edge on focus
 *    GoldButton    — the gradient-gold CTA
 *    TabBar        — glass bottom nav, animated gold pill indicator
 *    Stagger/StaggerItem — staggered list entrances (cinema ease)
 *    StatTile      — animated counting stat
 *    EmptyState    — cinematic empty state (gold ring icon)
 *    Wordmark      — flame + MAZAJ display wordmark
 *    SheetGrip     — bottom-sheet grab handle
 *    FadeSwap      — animated panel content swap
 *    EASE          — the one true easing curve [0.22, 1, 0.36, 1]
 *
 *  Rules of the house:
 *   • titles → font-display (Playfair/Amiri); UI copy stays sans
 *   • gold, amber, ember only — never indigo/blue
 *   • every motion respects prefers-reduced-motion
 *   • touch targets ≥ 44px · logical RTL properties (start/end)
 * ─────────────────────────────────────────────────────────────────
 */

import * as React from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* ScreenShell — the stage every app screen plays on                    */
/* ------------------------------------------------------------------ */

export function ScreenShell({
  children,
  className,
  /** richer backdrop for hero moments (sign-in) — adds drifting embers */
  embers = false,
  emberDensity = 0.5,
}: {
  children: React.ReactNode;
  className?: string;
  embers?: boolean;
  emberDensity?: number;
}) {
  return (
    <div
      className={cn(
        "dark relative flex min-h-[100dvh] flex-col overflow-x-clip bg-[oklch(0.135_0.014_60)] text-foreground",
        className
      )}
    >
      {/* ambient warm glow field */}
      <div className="ember-glow pointer-events-none absolute inset-0" aria-hidden />
      {/* cinema grain */}
      <div className="noise-overlay" aria-hidden />
      {embers && <EmberField density={emberDensity} />}
      {/* vignette — pulls the eye to center */}
      <div
        className="pointer-events-none absolute inset-0 vignette opacity-60"
        aria-hidden
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EmberField — a calmer cousin of the landing canvas (cheaper, fixed)  */
/* ------------------------------------------------------------------ */

function EmberField({ density = 0.5 }: { density?: number }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let visible = !document.hidden;
    let w = 0;
    let h = 0;

    const sprite = (() => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "hsla(42, 95%, 74%, 1)");
      grad.addColorStop(0.3, "hsla(38, 92%, 62%, 0.85)");
      grad.addColorStop(1, "hsla(30, 90%, 55%, 0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      return c;
    })();

    interface Mote {
      x: number;
      y: number;
      vy: number;
      vx: number;
      size: number;
      life: number;
      maxLife: number;
      wob: number;
      wobS: number;
    }
    const motes: Mote[] = [];
    const spawn = (initial = false): Mote => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 16,
      vy: -(0.1 + Math.random() * 0.22),
      vx: (Math.random() - 0.5) * 0.08,
      size: 1 + Math.random() * 2.4,
      life: initial ? Math.random() * 6000 : 0,
      maxLife: 6000 + Math.random() * 5000,
      wob: Math.random() * Math.PI * 2,
      wobS: 0.0005 + Math.random() * 0.001,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(rect.width, 1);
      h = Math.max(rect.height, 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w < 640 ? 16 : 26) * density);
      motes.length = 0;
      for (let i = 0; i < n; i++) motes.push(spawn(true));
    };

    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) {
        last = now;
        return;
      }
      let dt = Math.min(now - last, 64);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.life += dt;
        m.wob += m.wobS * dt;
        m.x += (m.vx + Math.sin(m.wob) * 0.05) * dt * 0.06 * 16;
        m.y += m.vy * dt * 0.06 * 16;
        if (m.life >= m.maxLife || m.y < -16) {
          motes[i] = spawn();
          continue;
        }
        const t = m.life / m.maxLife;
        const alpha = t < 0.18 ? t / 0.18 : Math.pow(1 - (t - 0.18) / 0.82, 1.6);
        const s = m.size * (2.2 + Math.sin(t * Math.PI) * 1);
        ctx.globalAlpha = Math.max(alpha, 0) * 0.6;
        ctx.drawImage(sprite, m.x - s / 2, m.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onVis = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced, density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full"
    />
  );
}

/* ------------------------------------------------------------------ */
/* AppHeader — glass top bar with display wordmark                      */
/* ------------------------------------------------------------------ */

export function AppHeader({
  title,
  subtitle,
  icon,
  onBack,
  actions,
  className,
  /** show the gold MAZAJ flame + wordmark style */
  wordmark = false,
  sticky = true,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
  wordmark?: boolean;
  sticky?: boolean;
}) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE }}
      className={cn(
        "z-30 transition-all duration-500",
        sticky && "sticky top-0",
        scrolled
          ? "border-b border-white/[0.06] bg-[oklch(0.155_0.014_60/0.72)] shadow-[0_10px_36px_-18px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
          : "border-b border-transparent bg-transparent",
        className
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="glass grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 rtl:rotate-180">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}

        {wordmark ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Flame className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="font-display truncate text-lg font-bold tracking-wide text-gold-soft">
                {title ?? "Mazaj"}
              </p>
              {subtitle && (
                <p className="-mt-0.5 truncate text-[11px] text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                {icon}
              </span>
            )}
            <div className="min-w-0 leading-tight">
              <h1 className="font-display truncate text-xl font-bold tracking-tight text-gold-soft">
                {title}
              </h1>
              {subtitle && (
                <p className="-mt-0.5 truncate text-[11px] text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="ms-auto flex shrink-0 items-center gap-2">{actions}</div>
      </div>
      {/* gold hairline under the bar — the landing signature */}
      <div className={cn("ember-hairline mx-auto w-full max-w-5xl transition-opacity duration-500", scrolled ? "opacity-100" : "opacity-0")} aria-hidden />
    </motion.header>
  );
}

/* ------------------------------------------------------------------ */
/* Kicker — gold section label with hairline                            */
/* ------------------------------------------------------------------ */

export function Kicker({
  children,
  className,
  center = false,
}: {
  children: React.ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        center && "justify-center",
        className
      )}
    >
      <span className="ember-hairline w-8" aria-hidden />
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.34em] text-gold-soft">
        {children}
      </span>
      <span className="ember-hairline w-8" aria-hidden />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CineCard — glass card that lifts on hover                            */
/* ------------------------------------------------------------------ */

export function CineCard({
  children,
  className,
  interactive = false,
  ...rest
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-2xl",
        interactive &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.75)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GoldButton — the gradient-gold CTA                                   */
/* ------------------------------------------------------------------ */

export function GoldButton({
  children,
  className,
  size = "md",
  ...rest
}: React.ComponentProps<"button"> & { size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] font-bold text-[oklch(0.17_0.03_50)] shadow-[0_10px_30px_-10px_oklch(0.72_0.145_60/0.55)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.86_0.13_74)] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "px-4 py-2 text-xs uppercase tracking-wider",
        size === "md" && "px-5 py-2.5 text-sm",
        size === "lg" && "px-7 py-3.5 text-base",
        className
      )}
      {...rest}
    >
      {/* sheen sweep */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* TabBar — glass bottom nav, animated gold pill                        */
/* ------------------------------------------------------------------ */

export interface TabItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function TabBar({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[];
  active: string | null;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.07] bg-[oklch(0.155_0.014_60/0.82)] backdrop-blur-2xl",
        className
      )}
      aria-label="Sections"
    >
      <div
        className="no-scrollbar mx-auto flex w-full max-w-5xl items-stretch justify-start gap-0.5 overflow-x-auto px-1 md:justify-around"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {items.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-w-[64px] shrink-0 flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="tabbar-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-x-2 top-1 h-[calc(100%-12px)] rounded-2xl bg-primary/[0.13] ring-1 ring-primary/20"
                  aria-hidden
                />
              )}
              <span className="relative">
                {t.icon}
                {!!t.badge && t.badge > 0 && (
                  <span className="absolute -top-1.5 -end-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </span>
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Stagger — orchestrated list entrances                                */
/* ------------------------------------------------------------------ */

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: EASE },
  },
};

export function Stagger({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      animate="show"
      transition={{ delayChildren: delay }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* StatTile — animated counting stat                                    */
/* ------------------------------------------------------------------ */

export function StatTile({
  value,
  label,
  icon,
  suffix = "",
  className,
  /** plain text value instead of animated number */
  text,
}: {
  value?: number;
  text?: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  suffix?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = React.useState(0);
  const started = React.useRef(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (text !== undefined || value === undefined) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const dur = 1100;
          const tick = (now: number) => {
            const t = Math.min((now - t0) / dur, 1);
            setDisplay(Math.round((1 - Math.pow(1 - t, 4)) * (value ?? 0)));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.35 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [value, reduced, text]);

  return (
    <div
      ref={ref}
      className={cn(
        "glass relative overflow-hidden rounded-2xl p-4 text-center",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -top-8 left-1/2 h-16 w-24 -translate-x-1/2 rounded-full bg-primary/15 blur-2xl"
        aria-hidden
      />
      {icon && (
        <div className="relative mb-1.5 flex justify-center text-primary">
          {icon}
        </div>
      )}
      <p className="font-display relative text-2xl font-bold text-gold">
        {text ?? `${display}${suffix}`}
      </p>
      <p className="relative mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState — cinematic empty                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-8 py-14 text-center",
        className
      )}
    >
      {icon && (
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25">
          {icon}
        </span>
      )}
      <p className="font-display text-xl font-bold text-gold-soft">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Wordmark — flame + display wordmark                                  */
/* ------------------------------------------------------------------ */

export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn("font-display inline-flex items-center gap-2 font-bold tracking-wide", className)}
    >
      <Flame
        className={cn(
          "text-primary",
          size === "sm" && "size-4",
          size === "md" && "size-5",
          size === "lg" && "size-7"
        )}
      />
      <span
        className={cn(
          "text-gold-soft",
          size === "sm" && "text-base",
          size === "md" && "text-lg",
          size === "lg" && "text-3xl"
        )}
      >
        Mazaj
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* SheetGrip — bottom-sheet grab handle + kicker header                 */
/* ------------------------------------------------------------------ */

export function SheetGrip({ title, kicker }: { title?: React.ReactNode; kicker?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 pb-1 pt-2">
      <div className="h-1 w-10 rounded-full bg-white/15" aria-hidden />
      {kicker && (
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.34em] text-gold-soft">
          {kicker}
        </span>
      )}
      {title && (
        <h2 className="font-display text-center text-2xl font-bold tracking-tight text-gold-soft">
          {title}
        </h2>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FadeSwap — animated tab/panel content swap                           */
/* ------------------------------------------------------------------ */

export function FadeSwap({
  swapKey,
  children,
  className,
}: {
  swapKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={swapKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: EASE }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

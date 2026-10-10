"use client";

/**
 * ─────────────────────────────────────────────────────────────────
 *  MAZAJ — THE LIVING EMBER LOGO
 * ─────────────────────────────────────────────────────────────────
 *  A generative brand mark: a single-line hookah that draws itself
 *  in, breathing embers and procedurally-generated smoke that wobbles
 *  through an animated turbulence field (SVG displacement), over a
 *  molten-gold gradient — everything respects prefers-reduced-motion.
 *
 *    <MazajMark />     — the animated mark alone
 *    <MazajLogo />     — full lockup: mark + MAZAJ wordmark + مزاج
 *    <LogoSplash />    — the one-per-session boot splash
 *
 *  Geometry lives in src/lib/logo-geometry.ts (deterministic, shared
 *  with the PWA icon rasterizer so the home-screen icon matches).
 * ─────────────────────────────────────────────────────────────────
 */

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  COALS,
  emberTrail,
  HOOKAH_STROKES,
  LOGO_VIEWBOX,
  SMOKE_TENDRILS,
  SMOKE_PATHS,
} from "@/lib/logo-geometry";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* MazajMark — the animated SVG mark                                    */
/* ------------------------------------------------------------------ */

export function MazajMark({
  size = 44,
  animated = true,
  className,
  /** unique prefix for gradient/filter ids (defaults to useId) */
  idPrefix,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
  idPrefix?: string;
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced;
  const auto = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = idPrefix ?? `mz${auto}`;

  const height = (size * LOGO_VIEWBOX.h) / LOGO_VIEWBOX.w;

  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`}
      width={size}
      height={height}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Mazaj logo"
    >
      <defs>
        {/* molten gold */}
        <linearGradient id={`${p}-gold`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.68 0.15 55)" />
          <stop offset="45%" stopColor="oklch(0.82 0.14 70)" />
          <stop offset="100%" stopColor="oklch(0.92 0.1 85)" />
        </linearGradient>
        {/* smoke fades as it rises */}
        <linearGradient id={`${p}-smoke`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="oklch(0.95 0.05 85 / 0.85)" />
          <stop offset="55%" stopColor="oklch(0.9 0.06 80 / 0.5)" />
          <stop offset="100%" stopColor="oklch(0.9 0.06 80 / 0)" />
        </linearGradient>
        <radialGradient id={`${p}-ember`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.9 0.16 70)" />
          <stop offset="60%" stopColor="oklch(0.75 0.17 55)" />
          <stop offset="100%" stopColor="oklch(0.6 0.15 45 / 0)" />
        </radialGradient>
        {/* the halo glow behind the whole mark */}
        <radialGradient id={`${p}-halo`} cx="50%" cy="62%" r="55%">
          <stop offset="0%" stopColor="oklch(0.78 0.15 65 / 0.5)" />
          <stop offset="55%" stopColor="oklch(0.7 0.14 60 / 0.16)" />
          <stop offset="100%" stopColor="oklch(0.7 0.14 60 / 0)" />
        </radialGradient>

        {/* procedural smoke: fractal noise displaces the tendrils and
            the noise field itself drifts — organic wobble, zero JS */}
        <filter id={`${p}-smokefx`} x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.045"
            numOctaves={2}
            seed={7}
            result="noise"
          >
            {live && (
              <animate
                attributeName="baseFrequency"
                dur="16s"
                values="0.012 0.045;0.017 0.06;0.012 0.045"
                repeatCount="indefinite"
              />
            )}
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={6}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* soft gold bloom under the hookah strokes */}
        <filter id={`${p}-bloom`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* breathing halo */}
      {live ? (
        <motion.ellipse
          cx="60"
          cy="82"
          rx="46"
          ry="44"
          fill={`url(#${p}-halo)`}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.06, 1] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
          style={{ transformOrigin: "60px 82px" }}
        />
      ) : (
        <ellipse cx="60" cy="82" rx="46" ry="44" fill={`url(#${p}-halo)`} opacity={0.6} />
      )}

      {/* the smoke — generated paths through the turbulence field */}
      <g filter={`url(#${p}-smokefx)`} strokeLinecap="round" fill="none">
        {SMOKE_PATHS.map((d, i) => {
          const spec = SMOKE_TENDRILS[i];
          return live ? (
            <motion.path
              key={i}
              d={d}
              stroke={`url(#${p}-smoke)`}
              strokeWidth={spec.width}
              initial={{ opacity: 0 }}
              animate={{ opacity: [spec.opacity, spec.opacity * 0.45, spec.opacity] }}
              transition={{
                opacity: {
                  duration: spec.drift * 0.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.5 + i * 0.35,
                },
              }}
            />
          ) : (
            <path
              key={i}
              d={d}
              stroke={`url(#${p}-smoke)`}
              strokeWidth={spec.width}
              strokeLinecap="round"
              fill="none"
              opacity={spec.opacity}
            />
          );
        })}
      </g>

      {/* the hookah — draws itself in, stroke by stroke */}
      <g
        filter={`url(#${p}-bloom)`}
        stroke={`url(#${p}-gold)`}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {HOOKAH_STROKES.map((s, i) =>
          live ? (
            <motion.path
              key={i}
              d={s.d}
              strokeWidth={s.width}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { duration: 0.85, delay: s.delay, ease: EASE },
                opacity: { duration: 0.2, delay: s.delay },
              }}
            />
          ) : (
            <path key={i} d={s.d} strokeWidth={s.width} />
          )
        )}
      </g>

      {/* the coals — glowing embers that pulse */}
      <g>
        {COALS.map((c, i) =>
          live ? (
            <motion.circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={c.r * 2.1}
              fill={`url(#${p}-ember)`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{
                duration: 2.2 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.5,
              }}
            />
          ) : (
            <circle key={i} cx={c.x} cy={c.y} r={c.r * 2.1} fill={`url(#${p}-ember)`} opacity={0.8} />
          )
        )}
        {COALS.map((c, i) => (
          <circle
            key={`core-${i}`}
            cx={c.x}
            cy={c.y}
            r={c.r * 0.72}
            fill="oklch(0.93 0.11 80)"
          />
        ))}
      </g>

      {/* sparks — tiny embers escaping the bowl */}
      {live && (
        <g>
          {[0, 1, 2].map((i) => (
            <circle key={i} r={1.5} fill="oklch(0.9 0.14 72)" opacity={0.9}>
              <animateMotion
                path={`M ${58 + i * 3} 38 ${emberTrail(31 + i * 17)}`}
                dur={`${5.2 + i * 1.7}s`}
                begin={`${i * 1.9}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.95;0"
                dur={`${5.2 + i * 1.7}s`}
                begin={`${i * 1.9}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* MazajLogo — the full lockup (mark + wordmark)                        */
/* ------------------------------------------------------------------ */

const WORD = "MAZAJ";

export function MazajLogo({
  size = 96,
  animated = true,
  className,
  wordClassName,
  /** small line under the wordmark (e.g. "HOOKAH LOUNGE") */
  tagline,
  as = "div",
}: {
  size?: number;
  animated?: boolean;
  className?: string;
  wordClassName?: string;
  tagline?: React.ReactNode;
  as?: "div" | "h1" | "h2";
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced;
  const Tag = as;

  return (
    <Tag
      className={cn("flex flex-col items-center text-center select-none", className)}
    >
      <MazajMark size={size} animated={animated} />

      {/* Arabic brand mark — مزاج */}
      <motion.p
        initial={live ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.35, ease: EASE }}
        className="mt-4 text-[0.62rem] font-semibold tracking-[0.6em] text-muted-foreground"
        dir="rtl"
      >
        مــزاج
      </motion.p>

      {/* MAZAJ — letter-by-letter molten gold */}
      <p
        aria-label="MAZAJ"
        className={cn(
          "font-display mt-1 bg-gradient-to-b from-[oklch(0.93_0.1_85)] via-[oklch(0.84_0.13_72)] to-[oklch(0.7_0.14_58)] bg-clip-text text-4xl font-bold tracking-[0.14em] text-transparent sm:text-5xl",
          wordClassName
        )}
      >
        {WORD.split("").map((ch, i) => (
          <motion.span
            key={i}
            className="inline-block"
            initial={live ? { opacity: 0, y: 16, filter: "blur(6px)" } : false}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 1.45 + i * 0.07, ease: EASE }}
          >
            {ch}
          </motion.span>
        ))}
      </p>

      <motion.div
        initial={live ? { scaleX: 0 } : false}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.9, delay: 1.9, ease: EASE }}
        className="ember-hairline mt-3 w-28"
        aria-hidden
      />

      {tagline && (
        <motion.p
          initial={live ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 2.05, ease: EASE }}
          className="mt-2.5 text-[0.72rem] font-medium tracking-[0.3em] text-muted-foreground"
        >
          {tagline}
        </motion.p>
      )}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* LogoSplash — the one-per-session cinematic boot                       */
/* ------------------------------------------------------------------ */

const BOOT_KEY = "mazaj:boot-splash-v1";

export function LogoSplash() {
  const [show, setShow] = React.useState(false);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (reduced) return; // reduced motion → skip the show entirely
    let seen = false;
    try {
      seen = sessionStorage.getItem(BOOT_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    setShow(true);
    // Mark as seen only once the show has actually played — marking in
    // setup would make a StrictMode double-mount (dev) skip the splash
    // entirely, and an interrupted load would never see it again.
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(BOOT_KEY, "1");
      } catch {
        /* private mode — worst case it shows again next load */
      }
      setShow(false);
    }, 2650);
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="boot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-[oklch(0.135_0.014_60)]"
          aria-hidden
        >
          {/* ember ambience */}
          <div className="ember-glow pointer-events-none absolute inset-0" />
          <div className="noise-overlay pointer-events-none absolute inset-0" />
          <div className="vignette pointer-events-none absolute inset-0 opacity-70" />

          <div className="relative">
            <MazajLogo size={118} animated />
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.3, times: [0, 0.25, 0.8, 1], ease: "easeInOut" }}
            className="relative mt-6 text-[0.62rem] font-semibold uppercase tracking-[0.4em] text-gold-soft/80"
          >
            The Art of Mood
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

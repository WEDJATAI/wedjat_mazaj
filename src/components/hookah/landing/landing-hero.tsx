"use client";

import * as React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, QrCode } from "lucide-react";
import { useI18n } from "@/store/i18n";
import { EmberCanvas } from "./ember-canvas";
import { Magnetic, WordReveal } from "./primitives";

/**
 * LandingHero — the full-viewport cinematic opener.
 *
 * Layers (back → front):
 *   1. the hookah photograph, screen-blended into the black void + parallax
 *   2. rising embers + drifting smoke (custom canvas engine)
 *   3. cinematic vignette + film grain
 *   4. editorial typography with masked word reveals
 *   5. magnetic CTAs + travelling scroll cue
 */
export function LandingHero({
  onOrder,
  onGetApp,
}: {
  onOrder: () => void;
  onGetApp: () => void;
}) {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const ref = React.useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.22]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-38%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  const BASE = 0.95; // intro delay — the preloader hands off to the hero

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col overflow-hidden"
      aria-label="Mazaj hero"
    >
      {/* 1 — the photograph, melted into the void */}
      <motion.div style={{ y: imgY, scale: imgScale }} className="absolute inset-0">
        <img
          src="/images/landing-hero.png"
          alt=""
          aria-hidden
          draggable={false}
          className="h-full w-full select-none object-cover opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(65%_52%_at_50%_42%,transparent_0%,oklch(0.13_0.015_60/0.55)_78%,oklch(0.13_0.015_60/0.95)_100%)]" />
      </motion.div>

      {/* 2 — embers + smoke */}
      <EmberCanvas className="z-10" />

      {/* 3 — cinema treatment */}
      <div className="vignette pointer-events-none absolute inset-0 z-10" />
      <div className="noise-overlay z-10" />

      {/* 4 — typography */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-20 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-14 pt-28 text-center sm:pt-32"
      >
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: BASE, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 flex items-center gap-3 text-[0.6rem] font-semibold uppercase tracking-[0.46em] text-gold-soft sm:mb-8 sm:text-xs"
        >
          <span className="ember-hairline w-8 sm:w-14" aria-hidden />
          {t("landKicker")}
          <span className="ember-hairline w-8 sm:w-14" aria-hidden />
        </motion.p>

        <h1 className="font-display text-[clamp(3rem,10.5vw,8.25rem)] font-bold leading-[1.04] tracking-tight">
          <span className="block text-gold">
            <WordReveal text={t("landHeroTitleA")} delay={BASE + 0.12} />
          </span>
          <span
            className={`block ${lang === "en" ? "italic" : ""} shimmer-line`}
          >
            <WordReveal text={t("landHeroTitleB")} delay={BASE + 0.42} />
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: BASE + 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl text-balance text-sm leading-relaxed text-muted-foreground sm:mt-8 sm:text-base"
        >
          {t("landHeroSub")}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: BASE + 1.05 }}
          className="mt-5 text-[0.62rem] font-medium uppercase tracking-[0.32em] text-foreground/45 sm:text-xs"
        >
          {t("landHeroMeta")}
        </motion.p>

        {/* 5 — CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: BASE + 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 flex flex-col items-center gap-3 sm:mt-11 sm:flex-row sm:gap-5"
        >
          <Magnetic>
            <button
              type="button"
              onClick={onOrder}
              className="cta-breathe group relative inline-flex h-13 items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-b from-[oklch(0.85_0.13_72)] to-[oklch(0.72_0.14_60)] px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-[oklch(0.17_0.03_50)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -translate-x-full transition-transform duration-700 group-hover:translate-x-full" />
              {t("landCtaOrder")}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </button>
          </Magnetic>

          <Magnetic>
            <button
              type="button"
              onClick={onGetApp}
              className="glass group inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-semibold text-foreground/90 transition-all duration-300 hover:border-primary/50 hover:text-primary"
            >
              <QrCode className="size-4 text-primary" />
              {t("getApp")}
            </button>
          </Magnetic>
        </motion.div>
      </motion.div>

      {/* scroll cue */}
      <motion.div
        style={{ opacity: cueOpacity }}
        className="relative z-20 flex flex-col items-center gap-2.5 pb-7"
      >
        <span className="text-[0.58rem] font-medium uppercase tracking-[0.34em] text-muted-foreground/70">
          {t("landScroll")}
        </span>
        <span className="relative h-11 w-px overflow-hidden bg-foreground/10">
          <span className="scroll-dot absolute left-0 top-0 h-3 w-px bg-primary" />
        </span>
      </motion.div>
    </section>
  );
}

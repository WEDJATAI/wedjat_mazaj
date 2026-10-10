"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Check,
  CloudOff,
  Flame,
  Gift,
  Radar,
  Wand2,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { useI18n } from "@/store/i18n";
import { usePwa } from "@/store/pwa";
import { BRANDS, egp } from "@/lib/catalog";
import { QrCodeSvg } from "../qr-code";
import { Counter, Reveal, SectionKicker } from "./primitives";
import { cn } from "@/lib/utils";

/* ================================================================== */
/* MARQUEE — the seven houses, drifting by                             */
/* ================================================================== */

const MARQUEE_BRANDS = [
  "MAZAYA",
  "AL FAKHER",
  "DANDASH",
  "NAKHLA",
  "AMY",
  "SALOM",
  "KASS",
  "MAZAJ+",
];

export function BrandMarquee() {
  const row = [...MARQUEE_BRANDS, ...MARQUEE_BRANDS];
  return (
    <div
      dir="ltr"
      className="relative overflow-hidden border-y border-white/5 bg-[oklch(0.14_0.014_60)] py-5"
      aria-hidden
    >
      <div className="marquee-track flex w-max items-center gap-10 pr-10">
        {[...row, ...row].map((b, i) => (
          <span key={i} className="flex items-center gap-10">
            <span className="font-display text-lg font-semibold tracking-[0.28em] text-foreground/30 sm:text-xl">
              {b}
            </span>
            <span className="text-[0.55rem] text-primary/60">✦</span>
          </span>
        ))}
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[oklch(0.14_0.014_60)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[oklch(0.14_0.014_60)] to-transparent" />
    </div>
  );
}

/* ================================================================== */
/* MENU PEEK — tonight's houses, real catalog data                     */
/* ================================================================== */

function minPrice(pricing: { fruits?: number; fruitsMix?: number; flat?: number }) {
  const vals = [pricing.fruits, pricing.fruitsMix, pricing.flat].filter(
    (v): v is number => typeof v === "number"
  );
  return Math.min(...vals);
}

export function MenuPeek({ onOpen }: { onOpen: () => void }) {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);

  return (
    <section className="relative py-20 sm:py-28" aria-label={t("landMenuPeek")}>
      <div className="mx-auto max-w-6xl px-6">
        <Reveal as="h2" className="text-center">
          <span className="font-display text-3xl font-bold text-gold-soft sm:text-5xl">
            {t("landMenuPeek")}
          </span>
        </Reveal>
        <Reveal delay={0.12}>
          <button
            type="button"
            onClick={onOpen}
            className="group mx-auto mt-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            {t("landMenuPeekSub")}
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </button>
        </Reveal>

        {/* horizontal brand strip */}
        <div className="no-scrollbar -mx-6 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 sm:mt-14 sm:justify-center sm:overflow-visible">
          {BRANDS.map((b, i) => (
            <Reveal key={b.id} delay={0.08 * i} className="snap-center">
              <button
                type="button"
                onClick={onOpen}
                className={cn(
                  "group relative flex w-[150px] flex-col items-start gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4 text-start shadow-[inset_0_1px_0_oklch(1_0_0/0.07)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-[0_18px_50px_-18px_oklch(0.78_0.15_65/0.35),inset_0_1px_0_oklch(0.78_0.15_65/0.15)] sm:w-[164px]",
                  i >= 4 && "sm:flex"
                )}
              >
                {b.category !== "regular" && (
                  <span className="absolute end-3 top-3 rounded-full bg-primary/15 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wider text-primary">
                    {b.badge ?? b.category}
                  </span>
                )}
                <span className="text-3xl" aria-hidden>
                  {b.emoji}
                </span>
                <span className="mt-1 font-display text-base font-semibold leading-tight">
                  {b.name}
                </span>
                <span className="text-[0.68rem] text-muted-foreground">
                  {t("from")} {egp(minPrice(b.pricing), lang)}
                </span>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* RITUAL — the three acts                                             */
/* ================================================================== */

function Act({
  index,
  title,
  desc,
  children,
  flip,
}: {
  index: string;
  title: string;
  desc: string;
  children: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="relative grid items-center gap-10 py-14 sm:gap-16 md:grid-cols-2 md:py-20">
      {/* ghost numeral */}
      <span
        aria-hidden
        className={cn(
          "font-display pointer-events-none absolute -top-2 select-none text-[7rem] font-black leading-none text-white/[0.045] sm:text-[10rem] md:-top-8",
          flip ? "right-0 md:left-0 md:right-auto" : "left-0"
        )}
      >
        {index}
      </span>

      <Reveal
        className={cn("relative", flip && "md:order-2")}
        delay={0.05}
      >
        {children}
      </Reveal>

      <div className={cn("relative", flip && "md:order-1")}>
        <Reveal delay={0.15}>
          <span className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.4em] text-primary/80">
            {index} —
          </span>
          <h3 className="font-display mt-3 text-3xl font-bold leading-tight text-gold-soft sm:text-4xl">
            {title}
          </h3>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
            {desc}
          </p>
        </Reveal>
      </div>
    </div>
  );
}

/** The live-tracking mock — the visual for act three. */
function TrackingMock() {
  const steps = [
    { label: "✓", done: true },
    { label: "●", done: false, active: true },
    { label: "○", done: false },
  ];
  return (
    <div className="glass relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl p-5 shadow-2xl">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/15 blur-3xl" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Order #247
          </p>
          <p className="font-display mt-1 text-lg font-semibold">
            Double Apple Classic
          </p>
        </div>
        <span className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-lg">
          🍎
        </span>
      </div>

      <div className="mt-6 flex items-center">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full border text-xs",
                s.done && "border-primary/60 bg-primary/20 text-primary",
                s.active &&
                  "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_oklch(0.78_0.15_65/0.5)]",
                !s.done && !s.active && "border-border text-muted-foreground"
              )}
            >
              {s.active ? (
                <motion.span
                  animate={{ scale: [1, 1.35, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="block size-2 rounded-full"
                />
              ) : (
                s.label
              )}
            </span>
            {i < steps.length - 1 && (
              <span className="relative mx-1 h-px flex-1 bg-border">
                <motion.span
                  className="absolute inset-y-0 left-0 bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: i === 0 ? "100%" : "0%" }}
                  transition={{ duration: 1.6, delay: 0.4 }}
                />
              </span>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[oklch(0.85_0.13_72)] to-[oklch(0.72_0.14_60)]"
          initial={{ width: "12%" }}
          whileInView={{ width: "64%" }}
          viewport={{ once: false }}
          transition={{ duration: 2.4, ease: "easeInOut" }}
        />
      </div>
      <p className="mt-3 text-center text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
        Preparing · ~12 min
      </p>
    </div>
  );
}

export function Ritual() {
  const t = useI18n((s) => s.t);
  return (
    <section id="experience" className="relative scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionKicker className="justify-center">{t("landRitualKicker")}</SectionKicker>
        <Reveal as="h2" delay={0.1} className="mt-5 text-center">
          <span className="font-display text-3xl font-bold text-gold sm:text-5xl">
            {t("landRitualTitle")}
          </span>
        </Reveal>

        <div className="mt-8 sm:mt-12">
          <Act index="01" title={t("landRitual1T")} desc={t("landRitual1D")}>
            <div className="relative overflow-hidden rounded-3xl border border-white/8 shadow-2xl">
              <img
                src="/images/landing-flavors.png"
                alt="Exotic hookah flavors on dark slate"
                className="mask-fade-b aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-105"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
            </div>
          </Act>

          <Act index="02" title={t("landRitual2T")} desc={t("landRitual2D")} flip>
            <div className="relative overflow-hidden rounded-3xl border border-white/8 shadow-2xl">
              <img
                src="/images/landing-craft.png"
                alt="Hands packing a hookah bowl"
                className="mask-fade-b aspect-square w-full object-cover transition-transform duration-700 hover:scale-105"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
            </div>
          </Act>

          <Act index="03" title={t("landRitual3T")} desc={t("landRitual3D")}>
            <TrackingMock />
          </Act>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* FEATURES — the platform glass cards                                 */
/* ================================================================== */

export function Features() {
  const t = useI18n((s) => s.t);
  const cards = [
    {
      icon: Wand2,
      title: t("landFeatAiT"),
      desc: t("landFeatAiD"),
      span: "md:col-span-2",
    },
    { icon: Radar, title: t("landFeatTrackT"), desc: t("landFeatTrackD") },
    { icon: CloudOff, title: t("landFeatOfflineT"), desc: t("landFeatOfflineD") },
    { icon: Gift, title: t("landFeatLoyaltyT"), desc: t("landFeatLoyaltyD") },
  ];

  return (
    <section id="platform" className="relative scroll-mt-20 py-20 sm:py-28">
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[46rem] max-w-full -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      <div className="mx-auto max-w-6xl px-6">
        <SectionKicker className="justify-center">{t("landFeatKicker")}</SectionKicker>
        <Reveal as="h2" delay={0.1} className="mt-5 text-center">
          <span className="font-display text-3xl font-bold text-gold sm:text-5xl">
            {t("landFeatTitle")}
          </span>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:mt-16 sm:gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={0.08 * i} className={c.span}>
              <div className="glass group relative h-full overflow-hidden rounded-3xl p-6 transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/35 hover:bg-[oklch(0.24_0.02_60/0.55)] sm:p-7">
                <div className="pointer-events-none absolute -right-14 -top-14 size-40 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                  <c.icon className="size-5" />
                </span>
                <h3 className="font-display relative mt-5 text-xl font-semibold">
                  {c.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                  {c.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* STATS — the numbers band                                            */
/* ================================================================== */

export function Stats() {
  const t = useI18n((s) => s.t);
  const stats = [
    { value: 7, suffix: "", label: t("landStatHouses") },
    { value: 30, suffix: "+", label: t("landStatFlavors") },
    { value: 20, suffix: "g", label: t("landStatBowl") },
    { value: 2, suffix: "×1", label: t("landStatBogo") },
  ];
  return (
    <section className="relative border-y border-white/5 bg-[oklch(0.14_0.014_60)] py-14 sm:py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-4 gap-y-10 px-6 md:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={0.07 * i} className="text-center">
            <p className="font-display text-4xl font-bold text-gold sm:text-5xl">
              <Counter to={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground sm:text-xs">
              {s.label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ================================================================== */
/* APP SHOWCASE — phone mockup + QR                                    */
/* ================================================================== */

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[264px] sm:w-[290px]">
      {/* halo */}
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(50%_50%_at_50%_45%,oklch(0.78_0.15_65/0.16),transparent_75%)]" />
      <div className="float-soft relative">
        <div className="relative overflow-hidden rounded-[2.6rem] border-[5px] border-[oklch(0.28_0.015_60)] bg-[oklch(0.16_0.012_60)] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
          {/* notch */}
          <div className="absolute left-1/2 top-2.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
          {/* screen */}
          <div className="relative px-4 pb-5 pt-11">
            {/* app header */}
            <div className="flex items-center justify-between">
              <p className="font-display flex items-center gap-1.5 text-base font-bold">
                <Flame className="size-4 text-primary" />
                Mazaj
              </p>
              <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[0.58rem] font-bold text-primary">
                120 pts
              </span>
            </div>

            {/* search pill */}
            <div className="mt-3.5 h-8 rounded-xl border border-white/8 bg-white/[0.04]" />

            {/* brand chips */}
            <div className="mt-3 flex gap-2">
              {["🍇", "🍎", "🍉", "🌿"].map((e, i) => (
                <span
                  key={i}
                  className={cn(
                    "grid size-9 place-items-center rounded-xl border text-sm",
                    i === 0
                      ? "border-primary/50 bg-primary/15"
                      : "border-white/8 bg-white/[0.03]"
                  )}
                >
                  {e}
                </span>
              ))}
            </div>

            {/* order card */}
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  #247 · Table 6
                </p>
                <p className="text-[0.62rem] font-bold text-primary">~12 min</p>
              </div>
              <p className="mt-1.5 text-sm font-semibold">Double Apple Classic</p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                <motion.span
                  className="h-px flex-1 bg-primary/70"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: false }}
                  transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2 }}
                  style={{ originX: 0 }}
                />
                <span className="size-2 rounded-full border border-primary/50" />
                <span className="h-px flex-1 bg-border" />
                <span className="size-2 rounded-full border border-border" />
              </div>
              <p className="mt-2.5 text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground">
                Preparing
              </p>
            </div>

            {/* loyalty card */}
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-3.5">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-widest text-primary">
                  Mazaj+ · Silver
                </p>
                <p className="mt-0.5 text-[0.58rem] text-muted-foreground">
                  30 pts to Gold
                </p>
              </div>
              <span className="text-lg">🎁</span>
            </div>

            {/* tab bar */}
            <div className="mt-4 flex items-center justify-around border-t border-white/6 pt-3">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full",
                    i === 0 ? "w-5 bg-primary" : "w-1.5 bg-white/15"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShowcase({
  onGetApp,
}: {
  onGetApp: () => void;
}) {
  const t = useI18n((s) => s.t);
  // r57: installed devices never see the install CTA / QR
  const installed = usePwa((s) => s.installed);
  const [origin, setOrigin] = React.useState("https://wmazaj.vercel.app");
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const installUrl = `${origin}/?install=1`;
  const bullets = [t("landAppB1"), t("landAppB2"), t("landAppB3"), t("landAppB4")];

  return (
    <section id="app" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 md:grid-cols-2 md:gap-10">
        {/* copy */}
        <div>
          <SectionKicker>{t("landAppKicker")}</SectionKicker>
          <Reveal as="h2" delay={0.08} className="mt-5">
            <span className="font-display text-3xl font-bold text-gold sm:text-5xl">
              {t("landAppTitle")}
            </span>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
              {t("landAppDesc")}
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <ul className="mt-7 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
              {bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-foreground/85">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/15">
                    <Check className="size-3 text-primary" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.32} className="mt-9 flex flex-wrap items-center gap-4">
            {!installed && (
              <>
                <button
                  type="button"
                  onClick={onGetApp}
                  className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[oklch(0.85_0.13_72)] to-[oklch(0.72_0.14_60)] px-7 py-3 text-sm font-bold uppercase tracking-wider text-[oklch(0.17_0.03_50)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
                >
                  {t("getApp")}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                </button>
                {/* mini QR */}
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.96] p-2 pr-4">
                  <QrCodeSvg text={installUrl} size={56} />
                  <div className="text-[0.6rem] font-semibold uppercase leading-relaxed tracking-wider text-stone-600">
                    Scan to
                    <br />
                    install
                  </div>
                </div>
              </>
            )}
          </Reveal>
        </div>

        {/* phone */}
        <Reveal delay={0.15}>
          <PhoneMock />
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== */
/* FOOTER                                                              */
/* ================================================================== */

export function LandingFooter({ onEnter }: { onEnter: () => void }) {
  const t = useI18n((s) => s.t);
  return (
    <footer className="relative mt-auto border-t border-white/5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-14 text-center">
        <Reveal>
          <p className="font-display text-3xl font-bold text-gold sm:text-4xl">
            Mazaj <span className="text-primary">✦</span>
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.34em] text-muted-foreground">
            {t("landFooterTagline")}
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <div className="ember-hairline w-40" />
        </Reveal>
        <Reveal delay={0.2}>
          <button
            type="button"
            onClick={onEnter}
            className="glass mt-1 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_-8px_oklch(0.78_0.15_65/0.5)]"
          >
            {t("landEnter")}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </button>
        </Reveal>
        <Reveal delay={0.26}>
          <p className="mt-3 text-[0.65rem] text-muted-foreground/70">
            {t("landFooterCraft")} · © {new Date().getFullYear()} Mazaj Lounge ·{" "}
            {t("landFooterRights")}
          </p>
        </Reveal>
      </div>
    </footer>
  );
}

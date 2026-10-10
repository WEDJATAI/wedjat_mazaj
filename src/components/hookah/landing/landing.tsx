"use client";

import * as React from "react";
import Lenis from "lenis";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { ArrowRight, Flame, X } from "lucide-react";
import { useI18n } from "@/store/i18n";
import { usePwa } from "@/store/pwa";
import { LangToggle } from "../lang-toggle";
import { SignIn } from "../sign-in";
import { LandingHero } from "./landing-hero";
import {
  AppShowcase,
  BrandMarquee,
  Features,
  LandingFooter,
  MenuPeek,
  Ritual,
  Stats,
} from "./landing-sections";

const INTRO_KEY = "mazaj:landing-intro";

/* ------------------------------------------------------------------ */
/* Preloader — the curtain rise (once per session)                     */
/* ------------------------------------------------------------------ */

function Preloader() {
  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-[oklch(0.12_0.015_60)]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
    >
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-xs tracking-[0.5em] text-muted-foreground"
      >
        مــزاج
      </motion.p>
      <motion.p
        initial={{ opacity: 0, letterSpacing: "0.9em" }}
        animate={{ opacity: 1, letterSpacing: "0.42em" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="font-display mt-3 text-4xl font-bold text-gold sm:text-5xl"
      >
        MAZAJ
      </motion.p>
      <motion.span
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="ember-hairline mt-6 w-28"
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing — the cinematic home experience                              */
/* ------------------------------------------------------------------ */

export function Landing() {
  const t = useI18n((s) => s.t);
  const reduced = useReducedMotion();
  const setGetAppOpen = usePwa((s) => s.setGetAppOpen);
  const getAppOpen = usePwa((s) => s.getAppOpen);
  const setMarketingLandingActive = usePwa((s) => s.setMarketingLandingActive);

  const [intro, setIntro] = React.useState(true);
  const [signinOpen, setSigninOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const lenisRef = React.useRef<Lenis | null>(null);

  /* tell the PWA layer the marketing landing owns the screen — the
     install banner stays quiet while we're selling the app ourselves */
  React.useEffect(() => {
    setMarketingLandingActive(true);
    return () => setMarketingLandingActive(false);
  }, [setMarketingLandingActive]);

  /* intro curtain — once per session, never for reduced motion */
  React.useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen || reduced) {
      setIntro(false);
      return;
    }
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* private mode — still show once */
    }
    const tm = setTimeout(() => setIntro(false), 1500);
    return () => clearTimeout(tm);
  }, [reduced]);

  /* Lenis — the buttery scroll (skipped for reduced motion) */
  React.useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenisRef.current = lenis;
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduced]);

  /* nav state */
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* scroll lock while the sign-in overlay is open */
  React.useEffect(() => {
    const lenis = lenisRef.current;
    if (signinOpen) {
      lenis?.stop();
      document.body.style.overflow = "hidden";
    } else {
      lenis?.start();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [signinOpen]);

  /* the Get-App sheet (z-50) must never sit under our overlay (z-70) —
     if it opens while the overlay is up, gracefully step aside */
  React.useEffect(() => {
    if (getAppOpen) setSigninOpen(false);
  }, [getAppOpen]);

  /* Esc closes the overlay */
  React.useEffect(() => {
    if (!signinOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSigninOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signinOpen]);

  const scrollTo = React.useCallback((hash: string) => {
    const el = document.querySelector(hash);
    if (!el) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(el as HTMLElement, { offset: -76, duration: 1.5 });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const openSignin = React.useCallback(() => setSigninOpen(true), []);
  const openGetApp = React.useCallback(() => setGetAppOpen(true), [setGetAppOpen]);

  /* gold scroll progress */
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 26,
    restDelta: 0.001,
  });

  const navLinks = [
    { label: t("landNavExperience"), hash: "#experience" },
    { label: t("landNavPlatform"), hash: "#platform" },
    { label: t("landNavApp"), hash: "#app" },
  ];

  return (
    <div className="dark relative min-h-[100svh] bg-[oklch(0.12_0.015_60)] text-foreground">
      {/* intro curtain */}
      <AnimatePresence>{intro && <Preloader key="preloader" />}</AnimatePresence>

      {/* gold scroll progress */}
      <motion.div
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-[oklch(0.9_0.1_75)] via-primary to-[oklch(0.65_0.12_55)]"
        style={{ scaleX: progress }}
        aria-hidden
      />

      {/* nav */}
      <motion.header
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, delay: 1.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-40 px-4 pt-4 sm:px-6"
      >
        <nav
          className={`mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full px-4 py-2.5 transition-all duration-500 sm:px-5 ${
            scrolled
              ? "glass shadow-[0_14px_44px_-16px_rgba(0,0,0,0.8)]"
              : "border border-transparent"
          }`}
          aria-label="Main"
        >
          <button
            type="button"
            onClick={() => lenisRef.current?.scrollTo(0, { duration: 1.4 })}
            className="font-display flex items-center gap-2 text-lg font-bold tracking-wide"
            aria-label="Mazaj — back to top"
          >
            <Flame className="size-5 text-primary" />
            <span className="text-gold-soft">Mazaj</span>
          </button>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((l) => (
              <button
                key={l.hash}
                type="button"
                onClick={() => scrollTo(l.hash)}
                className="rounded-full px-4 py-2 text-[0.8rem] font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <LangToggle />
            <button
              type="button"
              onClick={openSignin}
              className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[oklch(0.85_0.13_72)] to-[oklch(0.72_0.14_60)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[oklch(0.17_0.03_50)] transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97] sm:px-5"
            >
              {t("landCtaOrder")}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
            </button>
          </div>
        </nav>
      </motion.header>

      {/* the film */}
      <main>
        <LandingHero onOrder={openSignin} onGetApp={openGetApp} />
        <BrandMarquee />
        <MenuPeek onOpen={openSignin} />
        <Ritual />
        <Stats />
        <Features />
        <AppShowcase onGetApp={openGetApp} />
      </main>
      <LandingFooter onEnter={openSignin} />

      {/* sign-in overlay — the gateway into the app */}
      <AnimatePresence>
        {signinOpen && (
          <motion.div
            key="signin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[70] overflow-y-auto bg-[oklch(0.12_0.015_60/0.92)] backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label={t("landEnter")}
          >
            <button
              type="button"
              onClick={() => setSigninOpen(false)}
              className="glass fixed start-4 top-4 z-10 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("back")}
            >
              <X className="size-5" />
            </button>
            <motion.div
              initial={{ y: 34, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <SignIn />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Download,
  CheckCircle2,
  Share,
  PlusSquare,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Smartphone,
  WifiOff,
  BellRing,
  Gift,
  QrCode,
  X,
  Zap,
} from "lucide-react";
import {
  installPromptRef,
  isNativeApp,
  setPlatformOverride,
  usePwa,
  detectPlatform,
  type InstallPlatform,
} from "@/store/pwa";
import { useI18n } from "@/store/i18n";
import type { Translations } from "@/lib/i18n";
import { QrCodeSvg } from "./qr-code";

/** Session flag — the banner stays quiet for the rest of the session once
 * the QR landing has been served (it already did the banner's job). */
export const INSTALL_LANDING_SESSION_KEY = "mazaj:install-landing-shown";

type T = (key: keyof Translations) => string;

type LandingPhase = "idle" | "waiting" | "ready" | "prompting" | "success";

/** Metadata from /downloads/app.json (version + size of the hosted APK). */
type AppMeta = { version: string; sizeBytes: number };
const APK_URL = "/downloads/mazaj.apk";
const APP_META_URL = "/downloads/app.json";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** QR codes are often scanned from inside social apps, whose in-app
 * browsers cannot "Add to Home Screen" — those users get a Safari-first
 * guide instead of the regular iOS steps. */
function detectInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAV|FBAN|FB_IAB|Instagram|Messenger|Snapchat|Twitter|Line\/|TikTok/i.test(
    navigator.userAgent,
  );
}

function detectInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (isNativeApp()) return true; // inside the installed APK — it IS the app
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}

/**
 * Full-screen, app-store-style install page. This is what a phone lands on
 * when the QR code is scanned (…/?install=1):
 *  - Android: big pulsing Install button → native download & install
 *  - iPhone:  guided Share → Add to Home Screen flow (Apple's only path)
 *  - Desktop: the QR itself, to scan with a phone
 * The moment the app is installed, the landing celebrates and hands over to
 * the app — which is two-way synced with the platform by design.
 */
export function InstallLanding() {
  const t = useI18n((s) => s.t);
  const open = usePwa((s) => s.installLandingOpen);
  const setOpen = usePwa((s) => s.setInstallLandingOpen);
  const platform = usePwa((s) => s.platform);
  const canInstall = usePwa((s) => s.canInstall);

  const [phase, setPhase] = React.useState<LandingPhase>("idle");
  const [origin, setOrigin] = React.useState("https://wmazaj.vercel.app");
  const [inApp, setInApp] = React.useState(false);
  const [appMeta, setAppMeta] = React.useState<AppMeta | null>(null);
  const [apkStarted, setApkStarted] = React.useState(false);

  // --- QR entry: ?install=1 takes over the whole screen ------------------
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("install") !== "1") return;

    const alreadyInstalled = detectInstalled();
    const inAppBrowser = detectInAppBrowser();
    setInApp(inAppBrowser);

    // Dev-only preview hook (?simulate=ios|android) so both phone branches
    // can be exercised from a desktop browser. Never active in production.
    const simulate = params.get("simulate");
    if (
      process.env.NODE_ENV !== "production" &&
      (simulate === "ios" || simulate === "android")
    ) {
      setPlatformOverride(simulate as InstallPlatform);
    }

    // Strip the params (unless the page sits in an in-app browser, where
    // Safari/Chrome must still see ?install=1 after "Open in Safari").
    if (!inAppBrowser) {
      const url = new URL(window.location.href);
      url.searchParams.delete("install");
      url.searchParams.delete("simulate");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }

    if (alreadyInstalled) return; // the app is on this phone already

    try {
      sessionStorage.setItem(INSTALL_LANDING_SESSION_KEY, "1");
    } catch {
      // private mode — non-fatal
    }
    setOrigin(window.location.origin);
    setOpen(true);

    // Dev-only: a mock native prompt so the full Android state machine
    // (ready → prompting → success) can be E2E-tested on desktop.
    if (process.env.NODE_ENV !== "production" && simulate === "android") {
      const fake = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
      fake.prompt = async () => {};
      fake.userChoice = new Promise((resolve) =>
        window.setTimeout(() => resolve({ outcome: "accepted" }), 900),
      );
      window.setTimeout(() => window.dispatchEvent(fake), 400);
    }
  }, []);

  // --- phase reset whenever the landing opens ----------------------------
  React.useEffect(() => {
    if (!open) return;
    setPhase(
      platform === "android"
        ? usePwa.getState().canInstall
          ? "ready"
          : "waiting"
        : "idle",
    );
    setApkStarted(false);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, platform]);

  // --- Android: fetch APK metadata (version · size) for the button sub-line
  React.useEffect(() => {
    if (!open || platform !== "android") return;
    let alive = true;
    fetch(APP_META_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (
          alive &&
          j &&
          typeof j.version === "string" &&
          typeof j.sizeBytes === "number"
        ) {
          setAppMeta({ version: j.version, sizeBytes: j.sizeBytes });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, platform]);

  // --- Android: waiting → ready the instant the browser offers the prompt --
  React.useEffect(() => {
    if (!open || platform !== "android" || phase === "success") return;
    if (canInstall && phase === "waiting") {
      setPhase("ready");
    } else if (!canInstall && phase === "ready") {
      setPhase("waiting");
    }
  }, [open, platform, canInstall, phase]);

  // --- celebrate when the OS finishes installing -------------------------
  React.useEffect(() => {
    const onInstalled = () => setPhase("success");
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  // --- auto-close a beat after success -----------------------------------
  React.useEffect(() => {
    if (phase !== "success") return;
    const id = window.setTimeout(() => setOpen(false), 3200);
    return () => window.clearTimeout(id);
  }, [phase, setOpen]);

  const installInstant = async () => {
    const prompt = installPromptRef.current;
    if (!prompt) return;
    setPhase("prompting");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setPhase(
        choice.outcome === "accepted"
          ? "success"
          : usePwa.getState().canInstall
            ? "ready"
            : "waiting",
      );
    } catch {
      setPhase(usePwa.getState().canInstall ? "ready" : "waiting");
    }
  };

  const installUrl = `${origin}/?install=1`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[80] overflow-y-auto bg-gradient-to-b from-[#16110e] via-[#1c1512] to-[#251a12]"
          role="dialog"
          aria-modal="true"
          aria-label={t("getApp")}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("later")}
            className="fixed right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>

          <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center px-5 py-10 text-center">
            {/* Hero */}
            <div className="relative mt-4">
              <div className="absolute inset-0 -z-10 scale-[1.8] animate-pulse rounded-full bg-primary/30 blur-3xl" />
              <Image
                src="/icons/icon-192.png"
                alt="Mazaj app icon"
                width={96}
                height={96}
                priority
                className="rounded-[1.4rem] shadow-2xl shadow-black/60 ring-1 ring-white/10"
              />
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight">
              Mazaj
            </h1>
            <p className="mt-1 text-sm font-medium text-amber-200/80">
              {t("landingTagline")}
            </p>
            <p className="mt-2.5 flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="text-amber-400" aria-hidden>
                ★★★★★
              </span>
              {t("installMeta")}
            </p>

            {/* Platform install card */}
            <div className="mt-6 w-full">
              {platform === "ios" ? (
                inApp ? (
                  <IosSafariFirst t={t} />
                ) : (
                  <IosSteps t={t} />
                )
              ) : platform === "android" ? (
                phase === "success" ? (
                  <InstallSuccess t={t} onDone={() => setOpen(false)} />
                ) : (
                  <div className="w-full space-y-3">
                    {/* Primary — direct APK download, zero Play Store */}
                    <motion.div
                      animate={{
                        boxShadow: [
                          "0 0 0 0 rgba(217,119,6,0.0)",
                          "0 0 34px 6px rgba(217,119,6,0.35)",
                          "0 0 0 0 rgba(217,119,6,0.0)",
                        ],
                      }}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                      className="w-full rounded-2xl"
                    >
                      <a
                        href={APK_URL}
                        download="Mazaj.apk"
                        onClick={() => setApkStarted(true)}
                        className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
                      >
                        <Download className="size-5" aria-hidden />
                        {t("apkButton")}
                      </a>
                    </motion.div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {apkStarted
                        ? t("apkStarted")
                        : `${t("apkSub")}${
                            appMeta
                              ? ` · v${appMeta.version} · ${(
                                  appMeta.sizeBytes / 1048576
                                ).toFixed(1)} MB`
                              : ""
                          }`}
                    </p>
                    {apkStarted && <ApkAfterSteps t={t} />}
                    {phase === "prompting" ? (
                      <p className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/70 py-3 text-xs font-medium text-muted-foreground backdrop-blur">
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        {t("installing")}
                      </p>
                    ) : (
                      canInstall && (
                        <>
                          <div className="flex items-center gap-2 py-1" aria-hidden>
                            <span className="h-px flex-1 bg-border" />
                            <span className="text-[11px] text-muted-foreground">
                              {t("orDivider")}
                            </span>
                            <span className="h-px flex-1 bg-border" />
                          </div>
                          <button
                            type="button"
                            onClick={installInstant}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card/70 text-sm font-semibold backdrop-blur transition-colors hover:bg-muted"
                          >
                            <Zap className="size-4 text-primary" aria-hidden />
                            {t("instantAdd")}
                          </button>
                        </>
                      )
                    )}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card/80 p-6 backdrop-blur">
                  <p className="flex items-center gap-2 text-base font-bold">
                    <QrCode className="size-4 text-primary" />{" "}
                    {t("scanWithPhone")}
                  </p>
                  <div className="rounded-2xl bg-white p-4 shadow-inner">
                    <QrCodeSvg text={installUrl} size={210} />
                  </div>
                  <p className="max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
                    {t("scanHint")}
                  </p>
                </div>
              )}
            </div>

            {platform === "android" && phase !== "success" && (
              <p className="mt-3 max-w-[36ch] text-[11px] leading-relaxed text-muted-foreground">
                {t("installAndroidIntro")}
              </p>
            )}

            {/* Feature chips */}
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium">
                <BellRing className="size-3 text-primary" /> {t("featTracking")}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium">
                <Gift className="size-3 text-primary" /> {t("featLoyalty")}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium">
                <WifiOff className="size-3 text-primary" /> {t("featOffline")}
              </span>
            </div>
            <p className="mt-3.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <RefreshCw className="mt-0.5 size-3 shrink-0 text-primary" />
              {t("syncDesc2")}
            </p>

            {/* Skip */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-auto pt-8 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {t("continueInBrowser")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* iPhone: Safari → Share → Add to Home Screen (Apple's install path) */
/* ------------------------------------------------------------------ */

function IosSteps({ t }: { t: T }) {
  const steps = [
    { icon: Share, text: "iosStep1" },
    { icon: PlusSquare, text: "iosStep2" },
    { icon: ArrowUpRight, text: "iosStep3" },
  ] as const;

  return (
    <div className="w-full space-y-4 rounded-3xl border border-border bg-card/80 p-5 backdrop-blur">
      <p className="flex items-center justify-center gap-2 text-base font-bold">
        <Smartphone className="size-4 text-primary" /> {t("installIosTitle")}
      </p>
      <p className="text-center text-xs text-muted-foreground">
        {t("installIosIntro")}
      </p>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li
            key={s.text}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3 text-left"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <s.icon className="size-6 shrink-0 text-primary" />
            <span className="text-sm leading-snug text-foreground/90">
              {t(s.text)}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-center text-[11px] text-muted-foreground">
        {t("iosInstallNote")}
      </p>
      <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-200">
        {t("iosNoStore")}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* iPhone inside an in-app browser (Instagram / FB / WhatsApp):        */
/* those browsers can't install — guide to Safari first               */
/* ------------------------------------------------------------------ */

function IosSafariFirst({ t }: { t: T }) {
  return (
    <div className="w-full space-y-4 rounded-3xl border border-border bg-card/80 p-5 backdrop-blur">
      <p className="flex items-center justify-center gap-2 text-base font-bold">
        <Share className="size-4 text-primary" /> {t("openInSafariTitle")}
      </p>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        {t("openInSafariDesc")}
      </p>
      <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3 text-left">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          1
        </span>
        <Share className="size-6 shrink-0 text-primary" />
        <span className="text-sm leading-snug text-foreground/90">
          {t("openInSafariStep")}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Android: sideload steps once the APK file download has started      */
/* ------------------------------------------------------------------ */

function ApkAfterSteps({ t }: { t: T }) {
  const steps = [t("apkStep1"), t("apkStep2"), t("apkStep3")];
  return (
    <div className="rounded-3xl border border-border bg-card/80 p-4 text-left backdrop-blur">
      <p className="mb-2 text-center text-xs font-bold">
        {t("apkAfterTitle")}
      </p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li
            key={s}
            className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="text-xs leading-snug text-foreground/90">
              {s}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InstallSuccess({
  t,
  onDone,
}: {
  t: T;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-col items-center gap-3 rounded-3xl border border-emerald-500/30 bg-card/80 p-6 text-center backdrop-blur"
    >
      <motion.span
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 12, stiffness: 220 }}
      >
        <CheckCircle2 className="size-14 text-emerald-500" />
      </motion.span>
      <p className="text-lg font-bold">{t("installSuccessTitle")}</p>
      <p className="max-w-[34ch] text-xs leading-relaxed text-muted-foreground">
        {t("installSuccessDesc")}
      </p>
      <Button
        className="mt-1 h-12 w-full rounded-2xl font-semibold"
        onClick={onDone}
      >
        {t("startUsing")}
      </Button>
    </motion.div>
  );
}

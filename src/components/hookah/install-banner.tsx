"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2 } from "lucide-react";
import { installPromptRef, usePwa } from "@/store/pwa";
import { useI18n } from "@/store/i18n";
import { INSTALL_LANDING_SESSION_KEY } from "./install-landing";

const DISMISS_KEY = "mazaj:install-dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Floating "install the app" banner for organic visits (a few seconds
 * after landing). QR arrivals (?install=1) are handled by the full-screen
 * InstallLanding instead — this banner stays quiet for that session.
 */
export function InstallBanner() {
  const t = useI18n((s) => s.t);
  const canInstall = usePwa((s) => s.canInstall);
  const standalone = usePwa((s) => s.standalone);
  const platform = usePwa((s) => s.platform);
  const setGetAppOpen = usePwa((s) => s.setGetAppOpen);
  const getAppOpen = usePwa((s) => s.getAppOpen);
  const landingOpen = usePwa((s) => s.installLandingOpen);

  const [visible, setVisible] = React.useState(false);
  const [installing, setInstalling] = React.useState(false);

  React.useEffect(() => {
    if (standalone) return;
    let dismissedRecently = false;
    let landingServed = false;
    try {
      const at = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
      dismissedRecently = Date.now() - at < DISMISS_COOLDOWN_MS;
      // the QR landing already did this banner's job this session
      landingServed =
        window.sessionStorage.getItem(INSTALL_LANDING_SESSION_KEY) === "1";
    } catch {
      dismissedRecently = false;
    }
    if (dismissedRecently || landingServed) return;
    const timer = setTimeout(() => setVisible(true), 6000);
    return () => clearTimeout(timer);
  }, [standalone]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (platform === "ios") {
      setGetAppOpen(true);
      setVisible(false);
      return;
    }
    const prompt = installPromptRef.current;
    if (!prompt) {
      setGetAppOpen(true);
      setVisible(false);
      return;
    }
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
    } catch {
      // ignore
    } finally {
      setInstalling(false);
    }
  };

  if (standalone || getAppOpen || landingOpen) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          className="fixed inset-x-3 bottom-[84px] z-[60] sm:inset-x-auto sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2"
          role="dialog"
          aria-label={t("installBanner")}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-card/95 p-3.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-xl">
              🔥
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {t("installBanner")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {t("installBannerDesc")}
              </p>
            </div>
            <Button
              size="sm"
              className="h-9 rounded-xl px-3 font-semibold"
              disabled={installing}
              onClick={install}
            >
              {installing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {canInstall || platform !== "ios" ? t("installNow") : t("howTo")}
            </Button>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("later")}
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
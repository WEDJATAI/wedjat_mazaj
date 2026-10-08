"use client";

import * as React from "react";
import {
  usePwa,
  detectPlatform,
  detectStandalone,
  installPromptRef,
} from "@/store/pwa";
import {
  flushQueue,
  queuedCount,
  subscribeQueue,
} from "@/lib/offline-queue";
import { GetAppSheet } from "./get-app-sheet";
import { InstallBanner } from "./install-banner";
import { SyncStatus } from "./sync-status";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * The PWA engine room, mounted once inside AppShell:
 *  - registers the service worker (installable app + offline support)
 *  - captures the native install prompt (Android / desktop Chrome)
 *  - tracks connectivity and replays the offline order queue on
 *    reconnect — the two-way sync between the installed app and the
 *    platform
 *  - renders the Get-App sheet, install banner and sync status chip
 */
export function PwaManager() {
  const setOnline = usePwa((s) => s.setOnline);
  const setStandalone = usePwa((s) => s.setStandalone);
  const setPlatform = usePwa((s) => s.setPlatform);
  const setCanInstall = usePwa((s) => s.setCanInstall);
  const setQueuedCount = usePwa((s) => s.setQueuedCount);
  const setSyncing = usePwa((s) => s.setSyncing);

  // --- register the service worker -------------------------------------
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      const mode =
        process.env.NODE_ENV === "production" ? "prod" : "dev";
      navigator.serviceWorker
        .register(`/sw.js?mode=${mode}`, { scope: "/" })
        .catch(() => {
          // not fatal — app still works online-only
        });
    }
  }, []);

  // --- platform / standalone / install-prompt detection ----------------
  React.useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(detectStandalone());
    setOnline(navigator.onLine);
    setQueuedCount(queuedCount());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      installPromptRef.current = null;
      setCanInstall(false);
      setStandalone(true);
    };
    const onDisplayMode = (e: MediaQueryListEvent) => {
      if (e.matches) setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener?.("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onDisplayMode);
    };
  }, [setPlatform, setStandalone, setOnline, setCanInstall, setQueuedCount]);

  // --- queue length tracking --------------------------------------------
  React.useEffect(() => {
    const unsub = subscribeQueue((n) => setQueuedCount(n));
    return unsub;
  }, [setQueuedCount]);

  // --- two-way sync: replay queued orders when connectivity returns -----
  React.useEffect(() => {
    let busy = false;

    const runFlush = async (announce: boolean) => {
      if (busy) return;
      if (!navigator.onLine) return;
      if (queuedCount() === 0) return;
      busy = true;
      setSyncing(true);
      try {
        const { synced, dropped } = await flushQueue();
        if (announce && synced > 0) {
          toast.success(
            synced === 1
              ? "Order synced ✓"
              : `${synced} orders synced ✓`,
            { description: "The lounge received your order(s)." }
          );
        }
        if (dropped > 0) {
          toast.error(`${dropped} queued order(s) couldn't be placed`, {
            description: "Please review and place them again.",
          });
        }
      } finally {
        busy = false;
        setSyncing(false);
      }
    };

    const onOnline = () => {
      setOnline(true);
      runFlush(true);
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setOnline(navigator.onLine);
        runFlush(false);
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    // initial attempt (orders queued from a previous offline session)
    runFlush(false);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [setOnline, setSyncing]);

  return (
    <>
      <GetAppSheet />
      <InstallBanner />
      <SyncStatus />
    </>
  );
}

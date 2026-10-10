"use client";

import * as React from "react";
import {
  usePwa,
  detectPlatform,
  detectStandalone,
  installPromptRef,
  readInstalledFlag,
  persistInstalledFlag,
  isNativeApp,
} from "@/store/pwa";
import {
  flushQueue,
  queuedCount,
  registerBackgroundSync,
  subscribeQueue,
} from "@/lib/offline-queue";
import {
  flushRequestQueue,
  queuedRequestCount,
} from "@/lib/request-queue";
import { refreshSubscriptionAfterChange } from "@/lib/push-client";
import { GetAppSheet } from "./get-app-sheet";
import { InstallBanner } from "./install-banner";
import { InstallLanding } from "./install-landing";
import { SyncStatus } from "./sync-status";
import { toast } from "sonner";

/**
 * The PWA engine room, mounted once inside AppShell:
 *  - registers the service worker (installable app + offline support)
 *  - captures the native install prompt (Android / desktop Chrome)
 *  - tracks connectivity and replays the offline order queue on
 *    reconnect — the two-way sync between the installed app and the
 *    platform (Background Sync does it in the worker on supporting
 *    browsers, even with the app closed)
 *  - listens to the worker: synced orders, rotated push subscriptions,
 *    new app versions ("update available" toast)
 *  - asks for persistent storage so the offline queue/menu survive
 *    browser storage pressure on the phone
 *  - renders the Get-App sheet, install landing, banner and sync chip
 */
export function PwaManager() {
  const setOnline = usePwa((s) => s.setOnline);
  const setStandalone = usePwa((s) => s.setStandalone);
  const setInstalled = usePwa((s) => s.setInstalled);
  const setPlatform = usePwa((s) => s.setPlatform);
  const setCanInstall = usePwa((s) => s.setCanInstall);
  const setQueuedCount = usePwa((s) => s.setQueuedCount);
  const setSyncing = usePwa((s) => s.setSyncing);

  // --- register the service worker + update detection ----------------------
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const mode =
      process.env.NODE_ENV === "production" ? "prod" : "dev";

    let reloading = false;
    const onControllerChange = () => {
      // a new worker took control (user tapped "reload" on the update toast)
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker
      .register(`/sw.js?mode=${mode}`, { scope: "/" })
      .then((reg) => {
        // already-waiting worker (registered before this page load)
        if (reg.waiting && reg.active) showUpdateToast();

        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && reg.active) {
              showUpdateToast();
            }
          });
        });
      })
      .catch(() => {
        // not fatal — app still works online-only
      });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );
    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  // --- messages from the worker -------------------------------------------
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; synced?: number; dropped?: number; remaining?: number }
        | undefined;
      if (!data?.type) return;
      if (data.type === "ORDERS_SYNCED") {
        setQueuedCount(data.remaining ?? 0);
        if ((data.synced ?? 0) > 0) {
          toast.success(
            data.synced === 1
              ? "Order synced ✓"
              : `${data.synced} orders synced ✓`,
            { description: "The lounge received your order(s)." }
          );
        }
        if ((data.dropped ?? 0) > 0) {
          toast.error(`${data.dropped} queued order(s) couldn't be placed`, {
            description: "Please review and place them again.",
          });
        }
      }
      if (data.type === "PUSH_SUBSCRIPTION_CHANGE") {
        void refreshSubscriptionAfterChange();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [setQueuedCount]);

  // --- platform / standalone / install-prompt detection ----------------
  React.useEffect(() => {
    setPlatform(detectPlatform());
    const standalone = detectStandalone();
    setStandalone(standalone);
    // r57: installed = standalone | native APK | this browser completed an
    // install before — gates every "download the app" CTA
    setInstalled(standalone || isNativeApp() || readInstalledFlag());
    setOnline(navigator.onLine);
    void queuedCount().then(setQueuedCount);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e as typeof installPromptRef.current;
      setCanInstall(true);
      // the browser says the PWA is installable again → not installed in
      // this browser; drop the stale persisted marker (if any)
      if (!standalone && !isNativeApp()) {
        persistInstalledFlag(false);
        setInstalled(false);
      }
    };
    const onInstalled = () => {
      installPromptRef.current = null;
      setCanInstall(false);
      setStandalone(true);
      setInstalled(true);
      persistInstalledFlag(true);
      // installed apps: ask the browser to keep our offline data safe
      void navigator.storage?.persist?.().catch(() => {});
    };
    const onDisplayMode = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setStandalone(true);
        setInstalled(true);
        persistInstalledFlag(true);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener?.("change", onDisplayMode);

    // already running as the installed app → persistent storage too
    if (detectStandalone()) {
      void navigator.storage?.persist?.().catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onDisplayMode);
    };
  }, [setPlatform, setStandalone, setInstalled, setOnline, setCanInstall, setQueuedCount]);

  // --- r57: resilient Call/Coal replay -----------------------------------
  // queued service requests (cloud unreachable / offline) retry on
  // reconnect, on app focus, and on a slow 45s tick — the guest always
  // gets their coal even when the cloud blinks
  React.useEffect(() => {
    let busy = false;
    let lastAnnounced = 0;
    const runFlush = async (announce: boolean) => {
      if (busy) return;
      if (!navigator.onLine) return;
      if ((await queuedRequestCount()) === 0) return;
      busy = true;
      try {
        const delivered = await flushRequestQueue();
        if (delivered > 0 && announce && Date.now() - lastAnnounced > 4000) {
          lastAnnounced = Date.now();
          toast.success(
            delivered === 1
              ? "Call delivered ✓"
            : `${delivered} requests delivered ✓`,
            { description: "The lounge received your request(s)." }
          );
        }
      } finally {
        busy = false;
      }
    };
    const onOnline = () => setTimeout(() => runFlush(true), 800);
    const onVisible = () => {
      if (document.visibilityState === "visible") runFlush(true);
    };
    const tick = setInterval(() => runFlush(true), 45000);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    runFlush(false); // replay anything queued in a previous session
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(tick);
    };
  }, []);

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
      if ((await queuedCount()) === 0) return;
      busy = true;
      setSyncing(true);
      try {
        const { synced, dropped, deferred } = await flushQueue();
        if (deferred) {
          // the service worker owns the replay (Background Sync) — it
          // will message ORDERS_SYNCED; keep the spinner until then
          return;
        }
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
      // ensure the background-sync tag is queued (no-op when unsupported)
      void registerBackgroundSync();
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
      <InstallLanding />
      <GetAppSheet />
      <InstallBanner />
      <SyncStatus />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Update toast — new version installed on the server                  */
/* ------------------------------------------------------------------ */

let updateToastShown = false;

function showUpdateToast() {
  if (updateToastShown) return; // once per page load is enough
  updateToastShown = true;
  toast.info("Mazaj was updated ✨", {
    description: "A new version is ready — reload to pick it up.",
    duration: 12000,
    action: {
      label: "Reload",
      onClick: async () => {
        const reg = await navigator.serviceWorker?.getRegistration();
        reg?.waiting?.postMessage("SKIP_WAITING");
        // controllerchange (pwa-manager) performs the reload
        window.setTimeout(() => window.location.reload(), 800);
      },
    },
  });
}

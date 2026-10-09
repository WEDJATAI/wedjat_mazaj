"use client";

import { create } from "zustand";

export type InstallPlatform = "ios" | "android" | "desktop" | "other";

interface PwaState {
  /** browser reports connectivity */
  online: boolean;
  /** running as an installed standalone app */
  standalone: boolean;
  /** detected device platform */
  platform: InstallPlatform;
  /** beforeinstallprompt captured → native install available */
  canInstall: boolean;
  /** the Get-App sheet (QR + install) open state */
  getAppOpen: boolean;
  /** the full-screen install landing (QR / ?install=1) open state */
  installLandingOpen: boolean;
  /** offline orders waiting to sync */
  queuedCount: number;
  /** queue flush in progress */
  syncing: boolean;

  setOnline: (v: boolean) => void;
  setStandalone: (v: boolean) => void;
  setPlatform: (p: InstallPlatform) => void;
  setCanInstall: (v: boolean) => void;
  setGetAppOpen: (v: boolean) => void;
  setInstallLandingOpen: (v: boolean) => void;
  setQueuedCount: (n: number) => void;
  setSyncing: (v: boolean) => void;
}

export const usePwa = create<PwaState>()((set) => ({
  online: true,
  standalone: false,
  platform: "other",
  canInstall: false,
  getAppOpen: false,
  installLandingOpen: false,
  queuedCount: 0,
  syncing: false,
  setOnline: (online) => set({ online }),
  setStandalone: (standalone) => set({ standalone }),
  setPlatform: (platform) => set({ platform }),
  setCanInstall: (canInstall) => set({ canInstall }),
  setGetAppOpen: (getAppOpen) => set({ getAppOpen }),
  setInstallLandingOpen: (installLandingOpen) => set({ installLandingOpen }),
  setQueuedCount: (queuedCount) => set({ queuedCount }),
  setSyncing: (syncing) => set({ syncing }),
}));

/** Dev-only platform override — lets the install landing be previewed
 * for iOS/Android on a desktop machine (see ?simulate=…). detectPlatform()
 * consults it so every consumer stays consistent. */
let platformOverride: InstallPlatform | null = null;

export function setPlatformOverride(p: InstallPlatform | null) {
  platformOverride = p;
}

export function detectPlatform(): InstallPlatform {
  if (platformOverride) return platformOverride;
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (!/Mobi/i.test(ua)) return "desktop";
  return "other";
}

export function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (isNativeApp()) return true;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}

/** True when running inside the installed Mazaj APK (Capacitor WebView).
 * In that context the app IS the installed production app — install
 * banners/landing must never appear there. Two signals: the Capacitor
 * bridge (server.url apps) and Android WebView's "wv" UA marker. */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  if (typeof cap?.isNativePlatform === "function" && cap.isNativePlatform()) {
    return true;
  }
  return /\swv\)/.test(navigator.userAgent);
}

/** The native install prompt event lives outside the store (not
 * serializable) — keep it module-scoped here. */
export const installPromptRef: {
  current: (Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }) | null;
} = { current: null };

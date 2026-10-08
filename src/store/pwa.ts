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
  /** offline orders waiting to sync */
  queuedCount: number;
  /** queue flush in progress */
  syncing: boolean;

  setOnline: (v: boolean) => void;
  setStandalone: (v: boolean) => void;
  setPlatform: (p: InstallPlatform) => void;
  setCanInstall: (v: boolean) => void;
  setGetAppOpen: (v: boolean) => void;
  setQueuedCount: (n: number) => void;
  setSyncing: (v: boolean) => void;
}

export const usePwa = create<PwaState>()((set) => ({
  online: true,
  standalone: false,
  platform: "other",
  canInstall: false,
  getAppOpen: false,
  queuedCount: 0,
  syncing: false,
  setOnline: (online) => set({ online }),
  setStandalone: (standalone) => set({ standalone }),
  setPlatform: (platform) => set({ platform }),
  setCanInstall: (canInstall) => set({ canInstall }),
  setGetAppOpen: (getAppOpen) => set({ getAppOpen }),
  setQueuedCount: (queuedCount) => set({ queuedCount }),
  setSyncing: (syncing) => set({ syncing }),
}));

export function detectPlatform(): InstallPlatform {
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
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}

/** The native install prompt event lives outside the store (not
 * serializable) — keep it module-scoped here. */
export const installPromptRef: {
  current: (Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }) | null;
} = { current: null };

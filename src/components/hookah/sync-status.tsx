"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { usePwa } from "@/store/pwa";
import { useI18n } from "@/store/i18n";
import { SYNCED_EVENT } from "@/lib/offline-queue";

/**
 * Live sync chip — the visible face of the two-way sync.
 *  - Offline → amber "Offline · N orders waiting"
 *  - Flushing → spinning "Syncing orders…"
 *  - Just synced → green flash "Back online — orders synced ✓"
 *  - Online & idle → hidden (nothing to report)
 */
export function SyncStatus() {
  const t = useI18n((s) => s.t);
  const online = usePwa((s) => s.online);
  const queued = usePwa((s) => s.queuedCount);
  const syncing = usePwa((s) => s.syncing);
  const standalone = usePwa((s) => s.standalone);

  const [justSynced, setJustSynced] = React.useState(false);
  const syncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const handler = () => {
      setJustSynced(true);
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => setJustSynced(false), 4000);
    };
    window.addEventListener(SYNCED_EVENT, handler);
    return () => {
      window.removeEventListener(SYNCED_EVENT, handler);
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  const offline = !online;
  const show = offline || syncing || justSynced || queued > 0;
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="sync-chip"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -24, opacity: 0 }}
        className="pointer-events-none fixed inset-x-0 top-2 z-[70] flex justify-center px-4"
        style={{ paddingTop: standalone ? "env(safe-area-inset-top)" : 0 }}
      >
        <div
          role="status"
          aria-live="polite"
          className={
            offline
              ? "flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-950/90 px-3.5 py-1.5 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur-md"
              : syncing
              ? "flex items-center gap-2 rounded-full border border-primary/50 bg-card/95 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md"
              : "flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-950/90 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 shadow-lg backdrop-blur-md"
          }
        >
          {offline ? (
            <>
              <WifiOff className="size-3.5" />
              {queued > 0
                ? `${t("offlineMode")} · ${queued} ${t("queuedOrders")}`
                : t("offlineMode")}
            </>
          ) : syncing ? (
            <>
              <RefreshCw className="size-3.5 animate-spin" />
              {t("syncingOrders")}
            </>
          ) : (
            <>
              <CloudUpload className="size-3.5" />
              {t("ordersSynced")}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

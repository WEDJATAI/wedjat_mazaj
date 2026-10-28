"use client";

/**
 * r61 — Platform Control Center · COMMAND PALETTE (⌘K / Ctrl-K).
 *
 * The state-of-the-art power-user surface: fuzzy-filtered navigation +
 * actions, fully keyboard-driven (↑↓ navigate · Enter run · Esc close),
 * spring-animated. Every platform tab, the onboarding flow, refresh,
 * language toggle and sign-out are one keystroke away.
 */

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Boxes,
  Building2,
  Command,
  Globe,
  LayoutDashboard,
  Landmark,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  ScrollText,
  Settings2,
  ShoppingBag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/store/i18n";

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onAddVenue,
  onRefresh,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onNavigate: (tabKey: string) => void;
  onAddVenue: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const { t, toggle } = useI18n();
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const actions = React.useMemo<PaletteAction[]>(
    () => [
      {
        id: "tab-pulse",
        label: t("pccTabPulse"),
        hint: "⌘1",
        icon: <LayoutDashboard className="size-4" aria-hidden />,
        run: () => onNavigate("pulse"),
      },
      {
        id: "tab-venues",
        label: t("pccTabVenues"),
        hint: "⌘2",
        icon: <Building2 className="size-4" aria-hidden />,
        run: () => onNavigate("venues"),
      },
      {
        id: "tab-menu",
        label: t("pccTabMenu"),
        hint: "⌘3",
        icon: <Package className="size-4" aria-hidden />,
        run: () => onNavigate("menu"),
      },
      {
        id: "tab-orders",
        label: t("pccTabOrders"),
        hint: "⌘4",
        icon: <ShoppingBag className="size-4" aria-hidden />,
        run: () => onNavigate("orders"),
      },
      {
        id: "tab-inventory",
        label: t("pccTabInventory"),
        hint: "⌘5",
        icon: <Boxes className="size-4" aria-hidden />,
        run: () => onNavigate("inventory"),
      },
      {
        id: "tab-people",
        label: t("pccTabPeople"),
        hint: "⌘6",
        icon: <Users className="size-4" aria-hidden />,
        run: () => onNavigate("people"),
      },
      {
        id: "tab-finance",
        label: t("pccTabFinance"),
        hint: "⌘7",
        icon: <Landmark className="size-4" aria-hidden />,
        run: () => onNavigate("finance"),
      },
      {
        id: "tab-settings",
        label: t("pccTabSettings"),
        hint: "⌘8",
        icon: <Settings2 className="size-4" aria-hidden />,
        run: () => onNavigate("settings"),
      },
      {
        id: "act-add-venue",
        label: t("addVenue"),
        icon: <Plus className="size-4" aria-hidden />,
        run: onAddVenue,
      },
      {
        id: "act-refresh",
        label: t("pccRefreshAll"),
        icon: <RefreshCw className="size-4" aria-hidden />,
        run: onRefresh,
      },
      {
        id: "act-language",
        label: t("pccToggleLanguage"),
        icon: <Globe className="size-4" aria-hidden />,
        run: () => toggle(),
      },
      {
        id: "act-signout",
        label: t("signOut"),
        icon: <LogOut className="size-4" aria-hidden />,
        run: onSignOut,
      },
    ],
    [t, onNavigate, onAddVenue, onRefresh, onSignOut, toggle]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  // reset selection whenever the palette opens or the filter changes
  React.useEffect(() => {
    setIndex(0);
    setQuery("");
  }, [open]);
  React.useEffect(() => {
    setIndex(0);
  }, [query]);

  // keep the selected row in view
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const runAt = (i: number) => {
    const action = filtered[i];
    if (!action) return;
    onOpenChange(false);
    // let the close animation start before the action mutates the tree
    window.setTimeout(() => action.run(), 60);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(index);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-4 pt-[14vh] backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            className="glass w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[oklch(0.165_0.015_60/0.96)] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]"
            role="dialog"
            aria-modal="true"
            aria-label={t("pccPaletteLabel")}
            onKeyDown={onKeyDown}
          >
            {/* search row */}
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
              <Command className="size-4 shrink-0 text-primary" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("pccPalettePlaceholder")}
                aria-label={t("pccPalettePlaceholder")}
                className="h-13 min-h-13 w-full bg-transparent py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <kbd className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-inset ring-white/[0.09]">
                ESC
              </kbd>
            </div>

            {/* actions */}
            <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("pccPaletteEmpty")}
                </p>
              ) : (
                filtered.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => runAt(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                      i === index
                        ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
                        : "text-foreground/85 hover:bg-white/[0.05]"
                    )}
                  >
                    <span className="shrink-0">{a.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {a.label}
                    </span>
                    {a.hint && (
                      <kbd className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-inset ring-white/[0.09]">
                        {a.hint}
                      </kbd>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* footer */}
            <div className="flex items-center gap-4 border-t border-white/[0.07] px-4 py-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded bg-white/[0.06] px-1 ring-1 ring-inset ring-white/[0.09]">↑↓</kbd>
                {t("pccPaletteNavigate")}
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded bg-white/[0.06] px-1 ring-1 ring-inset ring-white/[0.09]">↵</kbd>
                {t("pccPaletteRun")}
              </span>
              <span className="ms-auto inline-flex items-center gap-1">
                <ScrollText className="size-3" aria-hidden />
                MAZAJ · {t("pccPaletteLabel")}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

/**
 * r61 — THE PLATFORM CONTROL CENTER.
 *
 * The platform owner's dedicated command surface (PIN 9999), replacing
 * the r57 single-page console with a full tabbed control panel:
 *
 *   Pulse      — live command dashboard (KPIs · trend · activity · health)
 *   Venues     — onboard / connect / suspend venues, grow branch networks
 *   Menu       — the platform-owned shisha menu + live price publishing
 *   Orders     — cross-venue order explorer with filters + pagination
 *   Inventory  — cross-branch stock matrix + platform totals + alerts
 *   People     — every account across the platform, roles + lifecycle
 *   Finance    — the full WEDJAT RSM revenue-share dashboard
 *   Settings   — the revenue-share engine + platform identity
 *
 * State of the art: ⌘K command palette (fuzzy, keyboard-driven, spring
 * physics), animated gold tab pill, FadeSwap tab transitions, live
 * 20–30s polling per tab, full EN/AR + RTL parity.
 *
 * The owner controls THE PLATFORM — the shisha operation inside every
 * venue — never the venues' own café/restaurant business.
 */

import * as React from "react";
import {
  Boxes,
  Building2,
  Command as CommandIcon,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import { useI18n } from "@/store/i18n";
import {
  AppHeader,
  FadeSwap,
  ScreenShell,
  TabBar,
  type TabItem,
} from "../kit/kit";
import { RsmFinanceSection } from "../rsm-finance-panel";
import { PulseTab } from "./pulse-tab";
import { VenuesTab } from "./venues-tab";
import { MenuTab } from "./menu-tab";
import { OrdersTab } from "./orders-tab";
import { InventoryTab } from "./inventory-tab";
import { PeopleTab } from "./people-tab";
import { SettingsTab } from "./settings-tab";
import { CommandPalette } from "./command-palette";

const TAB_KEYS = [
  "pulse",
  "venues",
  "menu",
  "orders",
  "inventory",
  "people",
  "finance",
  "settings",
] as const;
type TabKey = (typeof TAB_KEYS)[number];

/** ⌘1..⌘8 jump straight to a tab. */
const SHORTCUT_TABS: Record<string, TabKey> = {
  "1": "pulse",
  "2": "venues",
  "3": "menu",
  "4": "orders",
  "5": "inventory",
  "6": "people",
  "7": "finance",
  "8": "settings",
};

export function PlatformControlCenter({ onSignOut }: { onSignOut: () => void }) {
  const employee = useSession((s) => s.employee);
  const { t } = useI18n();
  const [tab, setTab] = React.useState<TabKey>("pulse");
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const employeeId = employee?.id ?? "";
  const selfId = employee?.id ?? "";

  /* keyboard shortcuts — ⌘K opens the palette, ⌘1..⌘8 jump to tabs */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (SHORTCUT_TABS[e.key]) {
        e.preventDefault();
        setTab(SHORTCUT_TABS[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tabs: (TabItem & { key: TabKey })[] = [
    { key: "pulse", label: t("pccTabPulse"), icon: <LayoutDashboard className="size-[18px]" aria-hidden /> },
    { key: "venues", label: t("pccTabVenues"), icon: <Building2 className="size-[18px]" aria-hidden /> },
    { key: "menu", label: t("pccTabMenu"), icon: <Package className="size-[18px]" aria-hidden /> },
    { key: "orders", label: t("pccTabOrders"), icon: <ShoppingBag className="size-[18px]" aria-hidden /> },
    { key: "inventory", label: t("pccTabInventory"), icon: <Boxes className="size-[18px]" aria-hidden /> },
    { key: "people", label: t("pccTabPeople"), icon: <Users className="size-[18px]" aria-hidden /> },
    { key: "finance", label: t("pccTabFinance"), icon: <Landmark className="size-[18px]" aria-hidden /> },
    { key: "settings", label: t("pccTabSettings"), icon: <Settings2 className="size-[18px]" aria-hidden /> },
  ];

  const refreshAll = () => {
    window.dispatchEvent(new Event("mazaj:platform-refresh"));
  };

  return (
    <ScreenShell embers emberDensity={0.22} className="min-h-screen">
      <AppHeader
        icon={<Building2 className="size-5" />}
        title={t("pccTitle")}
        subtitle={t("pccSubtitle")}
        actions={
          <>
            {/* ⌘K — the command palette trigger */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={t("pccPaletteLabel")}
              className="glass hidden h-11 items-center gap-2 rounded-full px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              <CommandIcon className="size-3.5" aria-hidden />
              <span>{t("pccPaletteShort")}</span>
              <kbd className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] ring-1 ring-inset ring-white/[0.09]">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={t("pccPaletteLabel")}
              className="glass grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground sm:hidden"
            >
              <CommandIcon className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={refreshAll}
              aria-label={t("pccRefreshAll")}
              className="glass grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <Loader2 className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              aria-label={t("signOut")}
              className="glass grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-5">
        <FadeSwap swapKey={tab} className={cn(tab === "pulse" && "min-h-[60vh]")}>
          {tab === "pulse" && <PulseTab employeeId={employeeId} />}
          {tab === "venues" && <VenuesTab employeeId={employeeId} />}
          {tab === "menu" && <MenuTab employeeId={employeeId} />}
          {tab === "orders" && <OrdersTab employeeId={employeeId} />}
          {tab === "inventory" && <InventoryTab employeeId={employeeId} />}
          {tab === "people" && <PeopleTab employeeId={employeeId} selfId={selfId} />}
          {tab === "finance" && (
            <section className="space-y-6">
              <div>
                <h2 className="sr-only">{t("pccTabFinance")}</h2>
                <RsmFinanceSection employeeId={employeeId} />
              </div>
            </section>
          )}
          {tab === "settings" && <SettingsTab employeeId={employeeId} />}
        </FadeSwap>
      </main>

      <TabBar
        items={tabs}
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={(k) => setTab(k as TabKey)}
        onAddVenue={() => window.dispatchEvent(new Event("mazaj:platform-add-venue"))}
        onRefresh={refreshAll}
        onSignOut={onSignOut}
      />
    </ScreenShell>
  );
}

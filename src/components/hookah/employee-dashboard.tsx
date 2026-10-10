"use client";

import * as React from "react";
import { useSession, EmployeeSession } from "@/store/session";
import { BowlBuilder } from "./bowl-builder";
import { InventoryPanel } from "./inventory-panel";
import { RequestsPanel } from "./requests-panel";
import { OrdersPanel } from "./orders-panel";
import { EmployeesPanel } from "./employees-panel";
import { PurchasesPanel } from "./purchases-panel";
import { ProfitPanel } from "./profit-panel";
import { SyncPanel } from "./sync-panel";
import { AnalyticsPanel } from "./analytics-panel";
import { LoyaltyPanel } from "./loyalty-panel";
import { LangToggle } from "./lang-toggle";
import { cn } from "@/lib/utils";
import {
  hasPermission,
  type Permission,
} from "@/lib/permissions";
import {
  useSmartAlerts,
  primeNotifications,
} from "@/hooks/use-smart-alerts";
import {
  PlusCircle,
  Boxes,
  BellRing,
  ScrollText,
  Users,
  ShoppingCart,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Crown,
  Bell,
  BellOff,
  QrCode,
  Wand2,
  ShieldX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { usePwa } from "@/store/pwa";
import { SommelierSheet } from "./sommelier-sheet";
import { EASE, EmptyState, FadeSwap, TabBar, type TabItem } from "./kit/kit";

interface TabDef extends TabItem {
  key: Permission;
  render: (signOut: () => void) => React.ReactNode;
}

export function EmployeeDashboard() {
  const employee = useSession((s) => s.employee) as EmployeeSession | null;
  const signOut = useSession((s) => s.signOut);
  const perms = employee?.permissions ?? [];

  // R49 smart alerts: chime + notification + badge for new orders/requests.
  const alerts = useSmartAlerts();

  // r54: AI sommelier for staff — help a guest choose a bowl.
  const [sommOpen, setSommOpen] = React.useState(false);

  // r56: the floating action cluster — one FAB, fans open on demand.
  const [fabOpen, setFabOpen] = React.useState(false);

  // Ask for notification permission once, on first interaction.
  React.useEffect(() => {
    const handler = () => primeNotifications();
    window.addEventListener("pointerdown", handler, { once: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, []);

  const tabs: TabDef[] = React.useMemo(
    () => [
      {
        key: "queue",
        label: "Queue",
        icon: <ScrollText className="size-5" />,
        render: (so) => <OrdersPanel onSignOut={so} />,
      },
      {
        key: "new_order",
        label: "New",
        icon: <PlusCircle className="size-5" />,
        render: (so) => (
          <BowlBuilder
            orderedByName={employee?.name ?? ""}
            employeeId={employee?.id ?? ""}
            onSignOut={so}
          />
        ),
      },
      {
        key: "inventory",
        label: "Inventory",
        icon: <Boxes className="size-5" />,
        render: (so) => <InventoryPanel onSignOut={so} />,
      },
      {
        key: "requests",
        label: "Requests",
        icon: <BellRing className="size-5" />,
        render: (so) => <RequestsPanel onSignOut={so} />,
      },
      {
        key: "employees",
        label: "Staff",
        icon: <Users className="size-5" />,
        render: (so) => <EmployeesPanel onSignOut={so} />,
      },
      {
        key: "purchases",
        label: "Buy",
        icon: <ShoppingCart className="size-5" />,
        render: (so) => <PurchasesPanel onSignOut={so} />,
      },
      {
        key: "profit",
        label: "Profit",
        icon: <TrendingUp className="size-5" />,
        render: (so) => <ProfitPanel onSignOut={so} />,
      },
      {
        key: "analytics",
        label: "Stats",
        icon: <BarChart3 className="size-5" />,
        render: (so) => <AnalyticsPanel onSignOut={so} />,
      },
      {
        key: "loyalty",
        label: "Mazaj+",
        icon: <Crown className="size-5" />,
        render: (so) => <LoyaltyPanel onSignOut={so} />,
      },
      {
        key: "sync",
        label: "Sync",
        icon: <RefreshCw className="size-5" />,
        render: (so) => <SyncPanel onSignOut={so} />,
      },
    ],
    [employee]
  );

  // Filter tabs by the employee's permissions.
  const visibleTabs = tabs.filter((t) => hasPermission(perms, t.key));

  // Default to the first visible tab, preferring the queue (order-receiving focus).
  const defaultTab = visibleTabs.find((t) => t.key === "queue") ?? visibleTabs[0];
  const [tab, setTab] = React.useState<Permission | null>(
    defaultTab?.key ?? null
  );

  // Switching to the queue/requests tab acknowledges unseen alerts.
  const selectTab = React.useCallback(
    (key: string) => {
      setTab(key as Permission);
      if (key === "queue" || key === "requests") {
        alerts.acknowledge();
      }
    },
    [alerts]
  );

  // If the current tab is no longer visible (permissions changed), reset.
  React.useEffect(() => {
    if (tab && !visibleTabs.some((t) => t.key === tab)) {
      setTab(defaultTab?.key ?? null);
    }
  }, [tab, visibleTabs, defaultTab]);

  if (!employee) return null;
  if (visibleTabs.length === 0) {
    return (
      <div className="dark flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[oklch(0.135_0.014_60)] px-6 text-center text-foreground">
        <EmptyState
          icon={<ShieldX className="size-6" />}
          title="No access"
          description="You don't have permission to access any section. Ask a super admin to assign you a role."
          action={
            <button
              type="button"
              className="glass rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={signOut}
            >
              Sign out
            </button>
          }
        />
      </div>
    );
  }

  const activeTab = visibleTabs.find((t) => t.key === tab) ?? defaultTab;

  const tabItems: TabItem[] = visibleTabs.map((t) => ({
    key: t.key,
    label: t.label,
    icon: t.icon,
    badge:
      t.key === "queue"
        ? alerts.pendingOrders
        : t.key === "requests"
        ? alerts.pendingRequests
        : 0,
  }));

  return (
    <div className="relative min-h-[100dvh] bg-[oklch(0.135_0.014_60)]">
      {/* cinematic crossfade between panels */}
      <FadeSwap swapKey={activeTab?.key ?? "none"}>
        {activeTab && activeTab.render(signOut)}
      </FadeSwap>

      <SommelierSheet
        open={sommOpen}
        onOpenChange={setSommOpen}
        guestName={employee.name}
        mode="staff"
      />

      {/* Floating action cluster — one gold FAB that fans open (QR, mute,
          language) so a permanent stack never covers panel content */}
      <div className="fixed start-4 bottom-[84px] z-50 flex flex-col items-center gap-2.5">
        <AnimatePresence>
          {fabOpen && (
            <>
              <motion.div
                key="fab-lang"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10 }}
                transition={{ duration: 0.22, delay: 0.15, ease: EASE }}
                className="glass grid size-10 place-items-center rounded-full"
              >
                <LangToggle className="border-0 bg-transparent px-1.5 text-[11px]" />
              </motion.div>
              <motion.button
                key="fab-mute"
                type="button"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10 }}
                transition={{ duration: 0.22, delay: 0.1, ease: EASE }}
                onClick={alerts.toggleMuted}
                aria-label={alerts.muted ? "Unmute alerts" : "Mute alerts"}
                title={alerts.muted ? "Unmute alerts" : "Mute alerts"}
                className={cn(
                  "grid size-10 place-items-center rounded-full border shadow-lg backdrop-blur-xl transition-colors",
                  alerts.muted
                    ? "border-white/[0.08] bg-white/[0.05] text-muted-foreground"
                    : "border-primary/40 bg-primary/15 text-primary"
                )}
              >
                {alerts.muted ? (
                  <BellOff className="size-4" />
                ) : (
                  <Bell className="size-4" />
                )}
              </motion.button>
              <motion.button
                key="fab-qr"
                type="button"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10 }}
                transition={{ duration: 0.22, delay: 0.05, ease: EASE }}
                onClick={() => usePwa.getState().setGetAppOpen(true)}
                aria-label="Show guest app QR"
                title="Show the guest download QR"
                className="glass grid size-10 place-items-center rounded-full text-primary shadow-lg transition-colors hover:border-primary/50 hover:bg-primary/20"
              >
                <QrCode className="size-4" />
              </motion.button>
              <motion.button
                key="fab-somm"
                type="button"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10 }}
                transition={{ duration: 0.22, ease: EASE }}
                onClick={() => {
                  setSommOpen(true);
                  setFabOpen(false);
                }}
                aria-label="AI Sommelier"
                title="AI Sommelier — recommend a bowl for a guest"
                className="glass grid size-10 place-items-center rounded-full text-primary shadow-lg transition-colors hover:border-primary/50 hover:bg-primary/20"
              >
                <Wand2 className="size-4" />
              </motion.button>
            </>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          onClick={() => setFabOpen((o) => !o)}
          whileTap={{ scale: 0.92 }}
          aria-label={fabOpen ? "Close actions" : "Open actions — AI sommelier, QR, alerts, language"}
          aria-expanded={fabOpen}
          title="AI Sommelier & more"
          className="relative grid size-12 place-items-center rounded-full bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_12px_34px_-10px_oklch(0.72_0.145_60/0.65)]"
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/30"
            aria-hidden
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={fabOpen ? "x" : "wand"}
              initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="grid place-items-center"
            >
              {fabOpen ? <X className="size-5" /> : <Wand2 className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Bottom tab bar — only shows tabs this employee can access.
          Horizontally scrollable so wide permission sets never cramp. */}
      <TabBar items={tabItems} active={activeTab?.key ?? null} onChange={selectTab} />
    </div>
  );
}

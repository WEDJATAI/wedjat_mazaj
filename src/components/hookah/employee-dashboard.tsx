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
} from "lucide-react";
import { usePwa } from "@/store/pwa";

interface TabDef {
  key: Permission;
  label: string;
  icon: React.ReactNode;
  render: (signOut: () => void) => React.ReactNode;
}

export function EmployeeDashboard() {
  const employee = useSession((s) => s.employee) as EmployeeSession | null;
  const signOut = useSession((s) => s.signOut);
  const perms = employee?.permissions ?? [];

  // R49 smart alerts: chime + notification + badge for new orders/requests.
  const alerts = useSmartAlerts();

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
    (key: Permission) => {
      setTab(key);
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
      <div className="dark relative flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <p className="text-lg font-semibold">No access</p>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to access any section. Ask a super
          admin to assign you a role.
        </p>
        <button
          className="rounded-xl border border-border px-4 py-2 text-sm"
          onClick={signOut}
        >
          Sign out
        </button>
      </div>
    );
  }

  const activeTab = visibleTabs.find((t) => t.key === tab) ?? defaultTab;

  return (
    <div className="relative min-h-screen bg-background">
      {activeTab && activeTab.render(signOut)}

      {/* Floating language toggle + alerts mute toggle + guest QR share */}
      <div className="fixed left-4 bottom-[72px] z-50 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => usePwa.getState().setGetAppOpen(true)}
          aria-label="Show guest app QR"
          title="Show the guest download QR"
          className="grid size-9 place-items-center rounded-full border border-primary/40 bg-primary/15 text-primary shadow-lg backdrop-blur-xl transition-colors hover:bg-primary/25"
        >
          <QrCode className="size-4" />
        </button>
        <button
          type="button"
          onClick={alerts.toggleMuted}
          aria-label={alerts.muted ? "Unmute alerts" : "Mute alerts"}
          title={alerts.muted ? "Unmute alerts" : "Mute alerts"}
          className={cn(
            "grid size-9 place-items-center rounded-full border shadow-lg backdrop-blur-xl transition-colors",
            alerts.muted
              ? "border-border bg-card/90 text-muted-foreground"
              : "border-primary/40 bg-primary/15 text-primary"
          )}
        >
          {alerts.muted ? (
            <BellOff className="size-4" />
          ) : (
            <Bell className="size-4" />
          )}
        </button>
        <LangToggle />
      </div>

      {/* Bottom tab bar — only shows tabs this employee can access */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl">
        <div
          className="mx-auto flex w-full max-w-5xl items-stretch justify-around px-1"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {visibleTabs.map((t) => (
            <TabButton
              key={t.key}
              active={activeTab?.key === t.key}
              onClick={() => selectTab(t.key)}
              icon={t.icon}
              label={t.label}
              badge={
                t.key === "queue"
                  ? alerts.pendingOrders
                  : t.key === "requests"
                  ? alerts.pendingRequests
                  : 0
              }
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge = 0,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {label}
    </button>
  );
}

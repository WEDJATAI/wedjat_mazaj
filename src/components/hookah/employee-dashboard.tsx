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
import { LangToggle } from "./lang-toggle";
import { cn } from "@/lib/utils";
import {
  hasPermission,
  type Permission,
} from "@/lib/permissions";
import {
  PlusCircle,
  Boxes,
  BellRing,
  ScrollText,
  Users,
  ShoppingCart,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

const TAB_BAR_H = 68;

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

      {/* Floating language toggle */}
      <div className="fixed left-4 bottom-[72px] z-50">
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
              onClick={() => setTab(t.key)}
              icon={t.icon}
              label={t.label}
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

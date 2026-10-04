"use client";

import * as React from "react";
import { useSession, EmployeeSession } from "@/store/session";
import { OrderScreen } from "./order-screen";
import { InventoryPanel } from "./inventory-panel";
import { RequestsPanel } from "./requests-panel";
import { OrdersPanel } from "./orders-panel";
import { cn } from "@/lib/utils";
import { PlusCircle, Boxes, BellRing, ScrollText } from "lucide-react";

type Tab = "order" | "orders" | "inventory" | "requests";

const TAB_BAR_H = 68;

export function EmployeeDashboard() {
  const employee = useSession((s) => s.employee) as EmployeeSession | null;
  const signOut = useSession((s) => s.signOut);
  const [tab, setTab] = React.useState<Tab>("order");

  if (!employee) return null;

  const handleSignOut = () => {
    signOut();
  };

  return (
    <div className="relative min-h-screen bg-background">
      {tab === "order" && (
        <OrderScreen
          title="New order"
          subtitle={`Employee · ${employee.name}`}
          source="employee"
          orderedByName={employee.name}
          employeeId={employee.id}
          onSignOut={handleSignOut}
          bottomInset={TAB_BAR_H}
          showTimer
        />
      )}
      {tab === "orders" && <OrdersPanel onSignOut={handleSignOut} />}
      {tab === "inventory" && <InventoryPanel onSignOut={handleSignOut} />}
      {tab === "requests" && <RequestsPanel onSignOut={handleSignOut} />}

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl">
        <div
          className="mx-auto flex w-full max-w-5xl items-stretch justify-around px-1"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <TabButton
            active={tab === "order"}
            onClick={() => setTab("order")}
            icon={<PlusCircle className="size-5" />}
            label="New"
          />
          <TabButton
            active={tab === "orders"}
            onClick={() => setTab("orders")}
            icon={<ScrollText className="size-5" />}
            label="Queue"
          />
          <TabButton
            active={tab === "inventory"}
            onClick={() => setTab("inventory")}
            icon={<Boxes className="size-5" />}
            label="Inventory"
          />
          <TabButton
            active={tab === "requests"}
            onClick={() => setTab("requests")}
            icon={<BellRing className="size-5" />}
            label="Requests"
          />
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

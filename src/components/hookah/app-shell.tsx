"use client";

import * as React from "react";
import { useSession } from "@/store/session";
import { SignIn } from "./sign-in";
import { EmployeeDashboard } from "./employee-dashboard";
import { GuestOrder } from "./guest-order";

function useHydrated() {
  const [h, setH] = React.useState(false);
  React.useEffect(() => setH(true), []);
  return h;
}

export function AppShell() {
  const role = useSession((s) => s.role);
  const hydrated = useHydrated();

  // Avoid a flash of the sign-in screen while the persisted session rehydrates.
  if (!hydrated) {
    return (
      <div className="dark relative flex min-h-screen items-center justify-center bg-background">
        <div className="ember-glow pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col items-center gap-3">
          <span className="grid size-14 animate-pulse place-items-center rounded-2xl bg-primary/15 text-primary text-3xl">
            🔥
          </span>
          <p className="text-sm text-muted-foreground">Mazaj…</p>
        </div>
      </div>
    );
  }

  if (role === "employee") return <EmployeeDashboard />;
  if (role === "guest") return <GuestOrder />;
  return <SignIn />;
}

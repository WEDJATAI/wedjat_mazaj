"use client";

import * as React from "react";
import { useSession } from "@/store/session";
import { SignIn } from "./sign-in";
import { EmployeeDashboard } from "./employee-dashboard";
import { GuestOrder } from "./guest-order";
import { PwaManager } from "./pwa-manager";
import { tableContextFromUrl, useTableContext } from "@/store/table-context";

function useHydrated() {
  const [h, setH] = React.useState(false);
  React.useEffect(() => setH(true), []);
  return h;
}

/** Capture the POS table context (?tableId=…&table=…) once on mount. */
function usePosTableLink() {
  React.useEffect(() => {
    const ctx = tableContextFromUrl(window.location.href);
    if (ctx && (ctx.tableId != null || ctx.tableName !== "")) {
      useTableContext.getState().set({ ...ctx, fromPosLink: true });
      // strip the params — the context lives in the store for this tab's
      // session; a clean URL avoids stale context on a later refresh
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("tableId");
        url.searchParams.delete("table");
        url.searchParams.delete("tableName");
        window.history.replaceState({}, "", url.pathname + (url.search || ""));
      } catch {
        // non-fatal
      }
    }
  }, []);
}

/** Push deep link (?track=…) — when nobody is signed in as a guest yet,
 *  stash the target so GuestOrder opens the tracker right after the guest
 *  checks in. (When a guest IS signed in, GuestOrder handles the URL
 *  itself on mount.) */
function usePendingTrackLink(role: string | null | undefined) {
  React.useEffect(() => {
    if (role === "guest") return; // GuestOrder consumes the URL directly
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("track");
      if (!t) return;
      window.sessionStorage.setItem(
        "mazaj:pending-track",
        JSON.stringify({ t, at: Date.now() })
      );
      const url = new URL(window.location.href);
      url.searchParams.delete("track");
      url.searchParams.delete("source");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    } catch {
      // non-fatal
    }
  }, [role]);
}

export function AppShell() {
  const role = useSession((s) => s.role);
  const hydrated = useHydrated();
  usePosTableLink();
  usePendingTrackLink(role);

  return (
    <>
      {/* PWA engine: install prompts, QR download sheet, two-way sync chip */}
      <PwaManager />
      <AppBody role={role} hydrated={hydrated} />
    </>
  );
}

function AppBody({
  role,
  hydrated,
}: {
  role: ReturnType<typeof useSession.getState>["role"];
  hydrated: boolean;
}) {

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

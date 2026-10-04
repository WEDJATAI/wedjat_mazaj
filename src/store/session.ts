"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Permission } from "@/lib/permissions";

export type Role = "employee" | "guest";

export interface EmployeeSession {
  id: string;
  name: string;
  role: string; // super_admin | admin | employee
  permissions: Permission[];
}

export interface GuestSession {
  name: string;
  table: string;
}

interface SessionState {
  role: Role | null;
  employee: EmployeeSession | null;
  guest: GuestSession | null;
  signInEmployee: (emp: EmployeeSession) => void;
  signInGuest: (g: GuestSession) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      employee: null,
      guest: null,
      signInEmployee: (emp) => set({ role: "employee", employee: emp, guest: null }),
      signInGuest: (g) => set({ role: "guest", employee: null, guest: g }),
      signOut: () => set({ role: null, employee: null, guest: null }),
    }),
    {
      name: "mazaj-session",
      version: 2,
      // Drop sessions that lack the `permissions` field (pre-round-5 schema)
      // so stale logins don't render a permissionless dashboard.
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as {
          role?: string;
          employee?: { permissions?: Permission[] } | null;
          guest?: unknown;
        };
        if (
          p.role === "employee" &&
          p.employee &&
          (!Array.isArray(p.employee.permissions) ||
            p.employee.permissions.length === 0)
        ) {
          // Force a fresh sign-in to repopulate permissions.
          return { role: null, employee: null, guest: null };
        }
        return p as SessionState;
      },
    }
  )
);

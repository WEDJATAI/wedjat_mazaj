"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Permission } from "@/lib/permissions";

export type Role = "employee" | "guest";

/** r57 — a branch the signed-in employee can operate (from /api/auth/employee). */
export interface EmployeeBranch {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  venueId: string;
  venueName: string;
  venueNameAr: string | null;
  isFlagship: boolean;
  isActive: boolean;
}

export interface EmployeeSession {
  id: string;
  name: string;
  // r57: platform_admin | venue_admin | super_admin | admin | employee
  role: string;
  permissions: Permission[];
  // multi-tenant scope
  venueId: string | null;
  /** the chosen working branch; null = floating across all (venue admin) */
  branchId: string | null;
  /** display name of the chosen branch (null when floating) */
  branchName?: string | null;
  /** every branch this employee may operate (empty for platform_admin) */
  branches: EmployeeBranch[];
}

export interface GuestSession {
  name: string;
  table: string;
  /** r57 — the branch the guest is sitting at (null = default/legacy) */
  branchId?: string | null;
  branchName?: string | null;
}

interface SessionState {
  role: Role | null;
  employee: EmployeeSession | null;
  guest: GuestSession | null;
  signInEmployee: (emp: EmployeeSession) => void;
  signInGuest: (g: GuestSession) => void;
  /** r57 — switch the working branch of the signed-in employee */
  setEmployeeBranch: (branchId: string | null) => void;
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
      setEmployeeBranch: (branchId) => {
        set((s) => {
          if (!s.employee) return s;
          const branch =
            s.employee.branches.find((b) => b.id === branchId) ?? null;
          return {
            employee: {
              ...s.employee,
              branchId,
              // keep a display name for surfaces that don't want to re-lookup
              branchName: branch ? branch.nameAr ?? branch.name : null,
            } as EmployeeSession,
          };
        });
      },
      signOut: () => set({ role: null, employee: null, guest: null }),
    }),
    {
      name: "mazaj-session",
      version: 3,
      // Drop stale sessions:
      //  - pre-permissions employees (v1/old v2) so they re-login
      //  - pre-branches employees (r56 and earlier) so the branch context
      //    (and the new branch chooser) repopulates from the fresh auth
      //  - guests with no branch context keep working (branchId is optional)
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as {
          role?: string;
          employee?: {
            permissions?: Permission[];
            branches?: EmployeeBranch[];
          } | null;
          guest?: unknown;
        };
        if (
          p.role === "employee" &&
          p.employee &&
          (!Array.isArray(p.employee.permissions) ||
            p.employee.permissions.length === 0 ||
            !Array.isArray(p.employee.branches))
        ) {
          // Force a fresh sign-in to repopulate permissions + branches.
          return { role: null, employee: null, guest: null };
        }
        return p as SessionState;
      },
    }
  )
);

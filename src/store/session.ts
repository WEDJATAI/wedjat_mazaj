"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "employee" | "guest";

export interface EmployeeSession {
  id: string;
  name: string;
  role: string; // shisha_man | admin
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
    { name: "mazaj-session" }
  )
);

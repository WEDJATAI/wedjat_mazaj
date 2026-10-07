"use client";

// R46: table context captured from the Wedjat RSM POS "Order Shisha"
// button — it opens mazaj as
//   https://wmazaj.vercel.app/?tableId=22&table=2
// The numeric tableId is the ONLY unambiguous reference (table names
// repeat across the restaurant's floors), so it is captured once on load,
// carried through the order flow and echoed to the RSM webhook so the
// items land on the RIGHT table's check.

import { create } from "zustand";

export interface TableContext {
  tableId: number | null;
  tableName: string;
  /** true when the context came from the POS link (vs typed manually) */
  fromPosLink: boolean;
  set: (ctx: { tableId: number | null; tableName: string; fromPosLink?: boolean }) => void;
  clear: () => void;
}

export const useTableContext = create<TableContext>()((set) => ({
  tableId: null,
  tableName: "",
  fromPosLink: false,
  set: (ctx) =>
    set({
      tableId: ctx.tableId ?? null,
      tableName: ctx.tableName ?? "",
      fromPosLink: ctx.fromPosLink ?? false,
    }),
  clear: () => set({ tableId: null, tableName: "", fromPosLink: false }),
}));

/** Parse ?tableId=…&table=… from a URL (client-side, once on app mount). */
export function tableContextFromUrl(
  url: string,
): { tableId: number | null; tableName: string } | null {
  try {
    const params = new URL(url, "https://x").searchParams;
    const idRaw = params.get("tableId");
    const nameRaw = params.get("table") ?? params.get("tableName") ?? "";
    const tableId =
      idRaw != null && idRaw !== "" && Number.isFinite(Number(idRaw))
        ? Number(idRaw)
        : null;
    const tableName = nameRaw.trim().slice(0, 40);
    if (tableId == null && tableName === "") return null;
    return { tableId, tableName };
  } catch {
    return null;
  }
}

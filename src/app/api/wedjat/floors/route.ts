import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncWedjatTables } from "@/lib/wedjat";

// GET /api/wedjat/floors — PUBLIC minimal projection of the restaurant's
// floor plan (floor names + the table numbers on each floor), mirrored
// from Wedjat RSM. Guests need this at check-in: when their typed table
// number exists on SEVERAL floors (indoor "5" and outdoor "5" are
// different checks) the app asks "indoors or outdoors?" so the order can
// land on the right table's check. No statuses, no ids, no POS internals —
// just the seating numbers of the cafe the guest is physically sitting in.
//
// r74: empty mirror (fresh deploy / RSM briefly down) → returns an empty
// list AND kicks a background bootstrap sync; the sign-in UI simply skips
// the floor question until the mirror fills (≤15 min via the Inngest job).
export async function GET() {
  try {
    const read = () =>
      db.wedjatTable.findMany({
        where: { active: true },
        select: { name: true, floorName: true },
        orderBy: [{ floorName: "asc" }, { name: "asc" }],
      });
    let rows = await read();
    const newest = rows.length
      ? await db.wedjatTable.findFirst({
          orderBy: { syncedAt: "desc" },
          select: { syncedAt: true },
        })
      : null;
    const stale =
      rows.length === 0 ||
      !newest?.syncedAt ||
      Date.now() - newest.syncedAt.getTime() > 10 * 60 * 1000;
    if (stale) {
      // r74: AWAIT the sync — a fire-and-forget gets suspended by the
      // serverless runtime right after this response returns, leaving a
      // 2-row partial mirror (observed on the first production hit). The
      // status fetch is typically sub-second; the Inngest */15 job remains
      // the scheduled refresher — this TTL heal covers partial mirrors too
      // (e.g. a suspended bootstrap) and keeps the floor question honest.
      await syncWedjatTables().catch(() => {});
      rows = await read();
    }
    const byFloor = new Map<string, string[]>();
    for (const r of rows) {
      const floor = r.floorName || "Main";
      const arr = byFloor.get(floor) ?? [];
      arr.push(r.name);
      byFloor.set(floor, arr);
    }
    const floors = [...byFloor.entries()].map(([floor, tables]) => ({
      floor,
      tables: [...new Set(tables)],
    }));
    return NextResponse.json({ ok: true, floors });
  } catch {
    return NextResponse.json({ ok: true, floors: [] });
  }
}

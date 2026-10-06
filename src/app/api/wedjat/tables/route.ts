import { NextResponse } from "next/server";
import { fetchWedjatTables } from "@/lib/wedjat";

export async function GET() {
  try {
    const tables = await fetchWedjatTables();
    return NextResponse.json({ ok: true, tables });
  } catch (err) {
    console.error("wedjat tables error", err);
    return NextResponse.json(
      { ok: false, error: "Could not fetch Wedjat tables" },
      { status: 500 }
    );
  }
}

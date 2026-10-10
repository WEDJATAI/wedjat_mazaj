import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * r57 — Platform health probe.
 *
 * One cheap DB round-trip so monitoring (and humans) can tell whether the
 * app is fully up (`ok: true`) or serving from a degraded database
 * (`ok: false` — the state that broke Call/Coal in the field). Never
 * throws, always JSON; the HTTP status code carries the signal for
 * uptime checkers.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        latencyMs: Date.now() - startedAt,
        time: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * r57 — Platform health probe.
 * r62 — deployment provenance: reports the exact commit SHA Vercel built
 *       from (VERCEL_GIT_COMMIT_SHA is injected by Vercel at build time).
 *       Guarantees the live deployment can always be matched against git —
 *       with a single-commit history there is exactly one legal answer.
 *
 * One cheap DB round-trip so monitoring (and humans) can tell whether the
 * app is fully up (`ok: true`) or serving from a degraded database
 * (`ok: false` — the state that broke Call/Coal in the field). Never
 * throws, always JSON; the HTTP status code carries the signal for
 * uptime checkers.
 */
export async function GET() {
  const startedAt = Date.now();
  const meta = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    env: process.env.VERCEL_ENV ?? "local",
    region: process.env.VERCEL_REGION ?? null,
  };
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
      deployment: meta,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        latencyMs: Date.now() - startedAt,
        time: new Date().toISOString(),
        deployment: meta,
      },
      { status: 503 }
    );
  }
}

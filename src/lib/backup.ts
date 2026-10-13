/**
 * r73 — automated off-site database backups.
 *
 * The r68 audit flagged "no automated Neon backups"; r69c shipped manual
 * tooling (scripts/backup-neon.mjs) plus a cron guide. This module makes
 * the backup a first-class platform feature:
 *
 *   • runBackup() snapshots EVERY table in ONE transaction (a consistent
 *     picture — no half-written orders), hashes the JSON and pushes it to
 *     the PRIVATE wedjat_mazaj_backups repo (data branch) via the GitHub
 *     Contents API, pruning anything beyond the newest 30 snapshots.
 *   • Every run is recorded in BackupRun (status/rows/size/off-site) so
 *     the Settings tab can show the owner exactly how fresh the last
 *     backup is — and let them run one on demand.
 *
 * Why GitHub and not the Turso database: Turso is Wedjat RSM's one-way
 * mirror and gets WIPED AND REBUILT on every restaurant sync (the r44
 * "phantom orders" root cause) — anything stored there is destroyed. The
 * main repo is PUBLIC, so backups (customer phones, loyalty, staff PINs)
 * must never land in it; the dedicated backup repo is PRIVATE.
 *
 * Fails soft: with no BACKUP_GITHUB_TOKEN/BACKUP_REPO the run still
 * records (offsite:false) — local dev and e2e run in that mode.
 */

import { createHash } from "crypto";
import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";

/** Every table, in dependency order (parents before children) so a
 *  restore can replay the snapshot with plain inserts. BackupRun itself
 *  is excluded — it's the log of the runs, not platform data, and it
 *  grows with every backup. */
const SNAPSHOT_TABLES = [
  "venue",
  "branch",
  "employee",
  "employeeSession",
  "inventoryItem",
  "flavorStock",
  "supplyItem",
  "serviceRequest",
  "favoriteMix",
  "order",
  "orderComment",
  "loyaltyMember",
  "pointsLedger",
  "pushSubscription",
  "purchase",
  "platformSetting",
  "pinAttempt",
  "guestAttempt",
  "errorLog",
] as const;

const RETENTION = 30; // snapshots kept on the data branch

export interface BackupResult {
  runId: string;
  kind: string;
  status: "success" | "partial" | "failed";
  tables: number;
  rows: number;
  sizeBytes: number;
  sha256: string;
  offsite: boolean;
  error?: string;
}

/* ── snapshot ─────────────────────────────────────────────────────── */

async function snapshotAll() {
  // ONE transaction → one consistent picture of the database: every
  // findMany resolves inside a single connection.
  const rows = await db.$transaction(async (tx) => {
    const client = tx as unknown as Record<
      string,
      { findMany: () => Promise<unknown[]> }
    >;
    return Promise.all(SNAPSHOT_TABLES.map((t) => client[t].findMany()));
  });
  const tables: Record<string, unknown[]> = {};
  let total = 0;
  SNAPSHOT_TABLES.forEach((t, i) => {
    tables[t] = rows[i];
    total += rows[i].length;
  });
  return { tables, rows: total, tablesCount: SNAPSHOT_TABLES.length };
}

/* ── off-site store: private GitHub repo, data branch ─────────────── */

function backupRepoConfigured(): boolean {
  return Boolean(process.env.BACKUP_GITHUB_TOKEN && process.env.BACKUP_REPO);
}

async function gh(path: string, init: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.BACKUP_GITHUB_TOKEN ?? ""}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

function timestampName(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `backups/mazaj-${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(
    date.getUTCDate()
  )}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}.json`;
}

async function pushSnapshotToGitHub(
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const path = timestampName(new Date());
  const res = await gh(`/repos/${process.env.BACKUP_REPO}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `backup ${path.split("/").pop()}`,
      branch: "data",
      content: Buffer.from(content, "utf8").toString("base64"),
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `github put ${res.status}` };
  }
  // best-effort retention prune — never fails the backup for this
  try {
    const listRes = await gh(
      `/repos/${process.env.BACKUP_REPO}/contents/backups?ref=data`,
      {}
    );
    if (!listRes.ok) return { ok: true };
    const files = (await listRes.json()) as { name: string; sha: string }[];
    const sorted = files
      .filter((f) => f.name.endsWith(".json"))
      .sort((a, b) => b.name.localeCompare(a.name)); // newest first
    for (const old of sorted.slice(RETENTION)) {
      await gh(
        `/repos/${process.env.BACKUP_REPO}/contents/backups/${old.name}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `retire ${old.name}`,
            branch: "data",
            sha: old.sha,
          }),
        }
      ).catch(() => {});
    }
  } catch {
    // retention is housekeeping, not correctness
  }
  return { ok: true };
}

/* ── the run ──────────────────────────────────────────────────────── */

export async function runBackup(kind: "cron" | "manual"): Promise<BackupResult> {
  let meta: { status: "success" | "partial" | "failed"; tables: number; rows: number; sizeBytes: number; sha256: string; offsite: boolean; error?: string };

  try {
    const snap = await snapshotAll();
    const payload = JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      tables: snap.tables,
    });
    const sha256 = createHash("sha256").update(payload).digest("hex");
    const sizeBytes = Buffer.byteLength(payload, "utf8");

    let offsite = false;
    let offsiteError: string | undefined;
    if (backupRepoConfigured()) {
      const pushed = await pushSnapshotToGitHub(payload);
      offsite = pushed.ok;
      if (!pushed.ok) offsiteError = pushed.error;
    }

    meta = {
      status: offsite || !backupRepoConfigured() ? "success" : "partial",
      tables: snap.tablesCount,
      rows: snap.rows,
      sizeBytes,
      sha256,
      offsite,
      error: offsiteError,
    };
  } catch (err) {
    meta = {
      status: "failed",
      tables: 0,
      rows: 0,
      sizeBytes: 0,
      sha256: "",
      offsite: false,
      error: err instanceof Error ? err.message : "snapshot failed",
    };
  }

  const run = await db.backupRun.create({
    data: {
      kind,
      status: meta.status,
      tables: meta.tables,
      rows: meta.rows,
      sizeBytes: meta.sizeBytes,
      sha256: meta.sha256,
      offsite: meta.offsite,
      error: meta.error ?? null,
    },
  });

  return { runId: run.id, kind, ...meta };
}

/** Settings tab feed — the newest 20 runs (no payloads, just the log). */
export async function listBackupRuns(client: PrismaClient = db) {
  return client.backupRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      kind: true,
      status: true,
      tables: true,
      rows: true,
      sizeBytes: true,
      offsite: true,
      error: true,
      createdAt: true,
    },
  });
}

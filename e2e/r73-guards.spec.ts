import { test, expect, request as playwrightRequest } from "@playwright/test";
import { db, cleanupE2EState } from "./helpers";

/**
 * r73 — automated off-site backups.
 *
 *  1. the cron entry point is a two-key door: the Vercel cron bearer
 *     (CRON_SECRET) or a platform_admin session. Anything else → 401.
 *  2. a valid cron hit snapshots every table and records the run
 *     (locally there is no BACKUP_REPO, so offsite:false — the graceful
 *     degradation path production never takes, but dev/e2e always does)
 *  3. the owner surface: list + "back up now" are platform_admin-only
 */

const BASE = "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "dev-e2e-cron-secret";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await cleanupE2EState();
  await db.$disconnect();
});

test("backup cron: the door only opens for the cron secret or the owner", async ({
  request,
}) => {
  // no credentials → 401
  const anon = await request.get(`${BASE}/api/platform/backup/cron`);
  expect(anon.status()).toBe(401);

  // wrong secret → 401
  const wrong = await request.get(`${BASE}/api/platform/backup/cron`, {
    headers: { authorization: "Bearer not-the-secret" },
  });
  expect(wrong.status()).toBe(401);

  // staff session is NOT enough for the cron path fallback (Hassan ≠ owner)
  const staff = await playwrightRequest.newContext();
  const staffLogin = await staff.post(`${BASE}/api/auth/employee`, {
    data: { pin: "1234" },
  });
  expect((await staffLogin.json()).ok).toBe(true);
  const staffHit = await staff.get(`${BASE}/api/platform/backup/cron`);
  expect(staffHit.status()).toBe(403);
  await staff.dispose();

  // the real cron secret → 200 + a recorded run
  await db.backupRun.deleteMany({});
  const cron = await request.get(`${BASE}/api/platform/backup/cron`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(cron.status()).toBe(200);
  const data = await cron.json();
  expect(data.ok).toBe(true);
  expect(data.result.kind).toBe("cron");
  expect(data.result.status).toBe("success"); // snapshot itself worked
  expect(data.result.tables).toBeGreaterThanOrEqual(19); // every model
  expect(data.result.rows).toBeGreaterThan(0);
  expect(data.result.sizeBytes).toBeGreaterThan(100);
  expect(data.result.sha256).toHaveLength(64);
  expect(data.result.offsite).toBe(false); // no BACKUP env locally — graceful

  // the run landed in the log
  const runs = await db.backupRun.findMany({ orderBy: { createdAt: "desc" } });
  expect(runs.length).toBe(1);
  expect(runs[0].kind).toBe("cron");
  expect(runs[0].offsite).toBe(false);
});

test("backup owner surface: list + run-now are platform_admin-only", async ({
  request,
}) => {
  // anonymous → 401 both ways
  expect((await request.get(`${BASE}/api/platform/backup`)).status()).toBe(401);
  expect(
    (await request.post(`${BASE}/api/platform/backup`)).status()
  ).toBe(401);

  // staff → 403 both ways
  const staff = await playwrightRequest.newContext();
  await staff.post(`${BASE}/api/auth/employee`, { data: { pin: "1234" } });
  expect((await staff.get(`${BASE}/api/platform/backup`)).status()).toBe(403);
  expect((await staff.post(`${BASE}/api/platform/backup`)).status()).toBe(403);
  await staff.dispose();

  // platform owner → list + manual run
  const owner = await playwrightRequest.newContext();
  const ownerLogin = await owner.post(`${BASE}/api/auth/employee`, {
    data: { pin: "9999" },
  });
  expect((await ownerLogin.json()).ok).toBe(true);

  const runRes = await owner.post(`${BASE}/api/platform/backup`);
  expect(runRes.status()).toBe(200);
  const runData = await runRes.json();
  expect(runData.ok).toBe(true);
  expect(runData.result.kind).toBe("manual");

  const listRes = await owner.get(`${BASE}/api/platform/backup`);
  expect(listRes.status()).toBe(200);
  const list = (await listRes.json()) as { runs: { kind: string }[] };
  expect(list.runs.length).toBeGreaterThanOrEqual(2);
  expect(list.runs[0].kind).toBe("manual"); // newest first
  await owner.dispose();
});

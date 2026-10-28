import { test, expect, request as playwrightRequest } from "@playwright/test";
import {
  db,
  branchIds,
  cleanupE2EState,
  E2E_TABLE_PREFIX,
  placeGuestOrder,
} from "./helpers";

/**
 * r72 — closing the last r71 leftover surfaces:
 *
 *  1. amend OPTIMISTIC CONCURRENCY
 *     a) a save pinned to a stale baseRevision is refused (409) instead
 *        of silently discarding the other editor's changes
 *     b) two amends racing on one order: every 409 rolls its stock
 *        delta back — the jar only ever pays for what the surviving
 *        itemsJson says (pre-r72 both losers decremented anyway)
 *  2. favorites: the unscoped GET (which used to list EVERY guest's
 *     saved mixes) is gone → 400; POST is per-IP rate limited (20/10min)
 *     with a staff bypass
 *  3. push/subscribe is per-IP rate limited (15/10min)
 *  4. /api/errors ingest is per-IP rate limited (30/10min) and the
 *     same-message dedupe still collapses the burst into one row
 *  5. the sommelier limiter is DB-backed now (was in-memory, per Vercel
 *     instance): 20/min per IP, staff sessions bypass it
 */

const MINT = { brandIdRaw: "mazaya", flavorName: "Mint" };
const APPLE = { brandIdRaw: "mazaya", flavorName: "Double Apple" };
const FAV_GUEST = `${E2E_TABLE_PREFIX} RateCheck`;
const PUSH_PREFIX = "https://r72-e2e.push.local";
const ERR_MESSAGE = "r72-e2e smoke error";

async function flagshipId(): Promise<string> {
  const ids = await branchIds();
  return ids["mazaj-zamalek"] ?? Object.values(ids)[0];
}

/** Deterministic start state — every test re-runs cleanly even on retry. */
async function resetSurface() {
  await db.guestAttempt.deleteMany({
    where: {
      key: {
        in: [
          "fav:127.0.0.1",
          "favdel:127.0.0.1",
          "push:127.0.0.1",
          "errors:127.0.0.1",
          "somm:127.0.0.1",
          "amend:127.0.0.1",
        ],
      },
    },
  });
  await db.favoriteMix.deleteMany({ where: { guestName: FAV_GUEST } });
  await db.pushSubscription.deleteMany({
    where: { endpoint: { startsWith: PUSH_PREFIX } },
  });
  await db.errorLog.deleteMany({ where: { message: { startsWith: "r72-e2e" } } });
}

function bowl(flavorName: string, emoji: string, id: string) {
  return {
    id,
    primaryBrandId: "mazaya",
    primaryBrandName: "Mazaya",
    emoji,
    accent: "",
    flavor: "fruits",
    flavorLabel: "Fruits",
    components: [
      {
        brandId: "mazaya",
        brandName: "Mazaya",
        flavorName,
        emoji,
        grams: 20,
      },
    ],
    molassesGrams: 20,
    unitPrice: 125,
    qty: 1,
    hookahType: "regular",
    ownType: null,
    forName: "r72 Tester",
  };
}

const appleBowl = bowl("Double Apple", "🍏", "e2e:r72:apple");
const mintBowl = bowl("Mint", "🌿", "e2e:r72:mint");

function amendBody(items: unknown[], extra: Record<string, unknown> = {}) {
  return { items, ownType: null, addons: [], actorName: "r72-e2e", ...extra };
}

async function jarGrams(branchId: string, jar: typeof MINT) {
  const row = await db.flavorStock.findFirst({
    where: { ...jar, brand: { branchId } },
    select: { stockGrams: true },
  });
  if (!row) throw new Error(`jar not seeded: ${JSON.stringify(jar)}`);
  return row.stockGrams;
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await cleanupE2EState();
  await db.$disconnect();
});

/* ── 1a. baseRevision pinning ─────────────────────────────────────── */

test("amend: stale baseRevision is refused instead of discarding changes", async ({
  request,
}) => {
  await resetSurface();
  const branchId = await flagshipId();
  const table = `${E2E_TABLE_PREFIX} R72-REV`;

  const { id } = await placeGuestOrder(
    "http://localhost:3000",
    branchId,
    table
  );

  // the tracking projection carries the revision the editor pins to
  const fetched = await request.get(`/api/orders?id=${id}`);
  expect(fetched.status()).toBe(200);
  const { orders } = await fetched.json();
  expect(orders.length).toBe(1);
  expect(orders[0].revision).toBe(0);

  // save pinned to the CURRENT revision → commits, bumps to 1
  const okRes = await request.post(`/api/orders/${id}/amend`, {
    data: amendBody([appleBowl, mintBowl], { baseRevision: 0 }),
  });
  expect(okRes.status()).toBe(200);
  const okData = await okRes.json();
  expect(okData.revision).toBe(1);

  // the same stale pin (an editor who never reloaded) → 409, nothing
  // written: the mint bowl it wanted to add never hits the jar
  const mintBefore = await jarGrams(branchId, MINT);
  const staleRes = await request.post(`/api/orders/${id}/amend`, {
    data: amendBody([appleBowl, mintBowl, mintBowl], { baseRevision: 0 }),
  });
  expect(staleRes.status()).toBe(409);
  const staleData = await staleRes.json();
  expect(staleData.error).toContain("just changed");
  expect(await jarGrams(branchId, MINT)).toBe(mintBefore); // rolled back

  // legacy callers (no baseRevision) still save — the pin is optional
  const lenient = await request.post(`/api/orders/${id}/amend`, {
    data: amendBody([appleBowl, mintBowl]),
  });
  expect(lenient.status()).toBe(200);

  const final = await db.order.findUnique({
    where: { id },
    select: { revision: true },
  });
  expect(final?.revision).toBe(2);
});

/* ── 1b. true parallel race on one order ──────────────────────────── */

test("amend: racing editors can never double-charge the jar", async ({
  request,
}) => {
  await resetSurface();
  const branchId = await flagshipId();
  const table = `${E2E_TABLE_PREFIX} R72-RACE`;

  // known jar levels for the invariant
  await db.flavorStock.updateMany({
    where: { ...MINT, brand: { branchId } },
    data: { stockGrams: 150 },
  });

  const { id } = await placeGuestOrder(
    "http://localhost:3000",
    branchId,
    table
  );

  const mintBefore = await jarGrams(branchId, MINT);

  // two editors, same instant, both add ONE mint bowl to the order
  const fire = () =>
    request.post(`/api/orders/${id}/amend`, {
      data: amendBody([appleBowl, mintBowl]),
    });
  const [a, b] = await Promise.all([fire(), fire()]);
  const statuses = [a.status(), b.status()];

  // every response is 200 (committed) or 409 (lost the race) — and at
  // least one editor always gets through
  for (const s of statuses) expect([200, 409]).toContain(s);
  const successes = statuses.filter((s) => s === 200).length;
  expect(successes).toBeGreaterThanOrEqual(1);

  // THE INVARIANT: the final itemsJson holds exactly ONE mint bowl, so
  // the jar must have paid exactly one bowl (20g) — pre-r72 both racing
  // amends decremented 20g each while only one itemsJson survived
  const mintAfter = await jarGrams(branchId, MINT);
  expect(mintBefore - mintAfter).toBe(20);

  const saved = await db.order.findUnique({
    where: { id },
    select: { revision: true, itemsJson: true },
  });
  const items = JSON.parse(saved?.itemsJson ?? "[]");
  const mintBowls = items.filter(
    (it: { components?: { flavorName: string }[] }) =>
      it.components?.some((c) => c.flavorName === "Mint")
  );
  expect(mintBowls.length).toBe(1);
  // one revision bump per committed save — no phantom revisions
  expect(saved?.revision).toBe(successes);
});

/* ── 2. favorites: scoped list + limiter + staff bypass ───────────── */

test("favorites: unscoped GET is gone, POST is rate limited, staff bypasses", async ({
  request,
}) => {
  await resetSurface();

  // the old "list every guest's mixes" footgun is closed
  const unscoped = await request.get("/api/favorites");
  expect(unscoped.status()).toBe(400);

  // scoped list works
  const scoped = await request.get(
    `/api/favorites?guestName=${encodeURIComponent(FAV_GUEST)}`
  );
  expect(scoped.status()).toBe(200);
  expect((await scoped.json()).favorites).toEqual([]);

  const favBody = (i: number) => ({
    guestName: FAV_GUEST,
    label: `r72 mix ${i}`,
    components: [
      {
        brandId: "mazaya",
        brandName: "Mazaya",
        flavorName: "Mint",
        emoji: "🌿",
        grams: 20,
      },
    ],
  });

  // 20 saves from one IP → all good
  for (let i = 1; i <= 20; i++) {
    const res = await request.post("/api/favorites", { data: favBody(i) });
    expect(res.status(), `save #${i}`).toBe(200);
  }
  // the 21st from the same IP → 429 + Retry-After
  const blocked = await request.post("/api/favorites", { data: favBody(21) });
  expect(blocked.status()).toBe(429);
  expect(blocked.headers()["retry-after"]).toBeTruthy();

  // a different IP has its own bucket (the local dev server honors
  // x-forwarded-for — same trick as the r71 spec)
  const otherIp = await request.post("/api/favorites", {
    headers: { "x-forwarded-for": "198.51.100.72" },
    data: favBody(101),
  });
  expect(otherIp.status()).toBe(200);

  // a signed-in staff member bypasses the guest limit entirely
  const staff = await playwrightRequest.newContext();
  const login = await staff.post("http://localhost:3000/api/auth/employee", {
    data: { pin: "1234" },
  });
  expect((await login.json()).ok).toBe(true);
  const staffSave = await staff.post("http://localhost:3000/api/favorites", {
    data: favBody(102),
  });
  expect(staffSave.status()).toBe(200);
  await staff.dispose();
});

/* ── 3. push subscribe limiter ────────────────────────────────────── */

test("push: subscribe is rate limited per IP", async ({ request }) => {
  await resetSurface();

  const sub = (i: number) => ({
    subscription: {
      endpoint: `${PUSH_PREFIX}/ep-${i}`,
      keys: { p256dh: "r72-e2e-key", auth: "r72-e2e-auth" },
    },
    guestName: FAV_GUEST,
    platform: "web",
  });

  for (let i = 1; i <= 15; i++) {
    const res = await request.post("/api/push/subscribe", { data: sub(i) });
    expect(res.status(), `subscribe #${i}`).toBe(200);
  }
  const blocked = await request.post("/api/push/subscribe", { data: sub(16) });
  expect(blocked.status()).toBe(429);
  expect(blocked.headers()["retry-after"]).toBeTruthy();
});

/* ── 4. error-report ingest limiter (+ dedupe still works) ────────── */

test("errors: ingest is rate limited and dedupe still collapses bursts", async ({
  request,
}) => {
  await resetSurface();

  for (let i = 0; i < 30; i++) {
    const res = await request.post("/api/errors", {
      data: { message: ERR_MESSAGE },
    });
    expect(res.status(), `report #${i}`).toBe(200);
  }
  const blocked = await request.post("/api/errors", {
    data: { message: ERR_MESSAGE },
  });
  expect(blocked.status()).toBe(429);

  // 30 identical reports → ONE row with a bumped counter, not 30 rows
  const rows = await db.errorLog.findMany({
    where: { message: { startsWith: "r72-e2e" } },
  });
  expect(rows.length).toBe(1);
  expect(rows[0].count).toBe(30);
});

/* ── 5. sommelier: DB-backed limiter + staff bypass ───────────────── */

test("sommelier: 20/min DB-backed limit, staff sessions bypass", async ({
  request,
}) => {
  await resetSurface();

  // invalid bodies cost zero LLM tokens but still pass the door limiter
  const bad = { messages: [] };
  for (let i = 0; i < 20; i++) {
    const res = await request.post("/api/ai/sommelier", { data: bad });
    expect(res.status(), `turn #${i}`).toBe(400);
  }
  const blocked = await request.post("/api/ai/sommelier", { data: bad });
  expect(blocked.status()).toBe(429);

  // signed-in staff sail past the limiter (they still get the 400 for
  // the invalid body — proving the request was NOT rate limited)
  const staff = await playwrightRequest.newContext();
  const login = await staff.post("http://localhost:3000/api/auth/employee", {
    data: { pin: "1234" },
  });
  expect((await login.json()).ok).toBe(true);
  const staffTurn = await staff.post(
    "http://localhost:3000/api/ai/sommelier",
    { data: bad }
  );
  expect(staffTurn.status()).toBe(400);
  await staff.dispose();
});

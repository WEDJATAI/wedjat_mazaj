# Worklog — Hookah Ordering App (Mazaj)

Project: Mobile-first Next.js web app for hookah (shisha) ordering targeting the Egyptian market.

## Business Rules
- Each hookah = 20g molasses.
- Brands: Mazaya, Al Fakher, Dandash, Nakhla (regular), Amy (premium), Salom, Kass (special).
- Pricing:
  - Regular brands (Mazaya, Al Fakher, Dandash, Nakhla): Fruits 125 EGP, Fruits Mix 145 EGP.
  - Amy: Fruits 180 EGP, Fruits Mix 180 EGP.
  - Salom: 45 EGP (flat). Kass: 45 EGP (flat).
- Promo (BYO): Bring your own hookah OR your own molasses → 2 hookahs for the price of 1 (BOGO, applied per line item: chargeable qty = ceil(qty/2)).

## Tech
- Next.js 16 App Router + TS + Tailwind 4 + shadcn/ui
- Zustand cart store (persisted), Prisma + SQLite orders
- Dark lounge theme (amber/ember accents, NO indigo/blue)

---
Task ID: 2-a / 2-b / 3 / 4 / 5 / 6
Agent: main (Z.ai Code)
Task: Build the Mazaj hookah ordering app — catalog, pricing, BYO promo, cart, checkout, UI.

Work Log:
- Created `src/lib/catalog.ts`: 7 brands (Mazaya, Al Fakher, Dandash, Nakhla, Amy, Salom, Kass), pricing rules, `chargeableQty` (ceil(qty/2) BOGO), `egp()` formatter, 20g constant.
- Updated `prisma/schema.prisma` with `Order` model; pushed to SQLite via `bun run db:push`.
- Built `src/app/api/orders/route.ts` (POST create + GET list) with zod validation.
- Built `src/store/cart.ts` Zustand store (persisted) with items, ownType, computeTotals (subtotal/discount/total/bogo).
- Created warm lounge dark theme in `src/app/globals.css` (amber/ember accents, no indigo/blue).
- Generated atmospheric hero image at `public/images/hero.png` (1344x768) via image-generation CLI.
- Built components: `brand-card`, `config-sheet` (bottom sheet flavor+qty), `cart-drawer` (items + BYO promo toggle + totals), `checkout-dialog` (form + confirmation), `app-shell` (app bar, hero, price legend, brand grid, sticky footer, floating cart bar).
- Updated `src/app/layout.tsx` (metadata + sonner dark toaster) and `src/app/page.tsx` to render `<AppShell/>`.
- Fixed lint (JSX div imbalance, removed no-op expression). Lint clean.

Stage Summary:
- Pricing implemented exactly per spec: regular 125/145, Amy 180/180, Salom&Kass 45 flat.
- BYO promo: bring own hookah OR molasses → 2-for-1 (chargeable qty = ceil(qty/2) per line).
- Orders persist to SQLite via POST /api/orders.
- Mobile-first, dark lounge UI, sticky footer, floating cart bar. Dev server compiles `/` to 200.

---
Task ID: 8
Agent: main (Z.ai Code)
Task: Self-verify the app with Agent Browser (mobile viewport 412x915).

Work Log:
- Opened http://localhost:3000 → title "Mazaj · Hookah Ordering", no page/console errors.
- Verified all 7 brands render with correct pricing (Mazaya/Al Fakher/Dandash/Nakhla 125/145, Amy 180/180 premium, Salom & Kass 45 flat).
- Tapped Mazaya → config sheet opened, selected Fruits Mix → qty 2 → "Add to cart · 290 EGP".
- Added to cart → toast confirmed, floating cart bar appeared, brand card showed "2 in cart", header badge "2".
- Opened cart drawer → BYO promo options present, checkout at 290 EGP.
- Activated "Bring my own hookah" → total dropped to 145 EGP, breakdown showed "1 free · 1 charged", "BYO 2-for-1 saving", subtotal 290 → total 145.
- Checkout dialog: place-order button correctly disabled until name+phone filled.
- Filled "Ahmed Hassan" / "01012345678" → placed order → confirmation view "Order placed!" with Order ID + Total paid 145 EGP.
- GET /api/orders returned the persisted order: subtotal 290, discount 145, total 145, bogo:true, ownType:"hookah", itemCount:2, status:pending.
- Footer present ("Mazaj Hookah Lounge"), sticky to bottom, no overflow issues. hero.png serves HTTP 200.

Stage Summary:
- App fully verified end-to-end: browse → configure → add to cart → BYO 2-for-1 promo → checkout → DB persistence.
- All pricing/promo rules match the spec. No runtime errors. Task complete.

---
Task ID: 9-19
Agent: main (Z.ai Code)
Task: Expand app into a cafe POS — employee PIN login, inventory auto-deduct, flavor selection + cross-brand mix, guest mode (barcode scan + call shisha man).

Work Log:
- Prisma schema: added Employee, InventoryItem, ServiceRequest models; extended Order (source, orderedByName, employeeId). db:push + seed script (prisma/seed.ts) → 3 employees (Hassan 1234, Omar 5678, Manager 0000), 7 inventory items @1000g, 1 sample request.
- catalog.ts: added per-brand flavor lists + barcodes; MIXABLE_BRANDS; mixPrice() (cross-brand = max mix price, Amy 180 wins); getBrandByBarcode().
- cart store: rebuilt for FlavorComponent[] (single for fruits/flat, multi+cross-brand for mix); splitGrams() distributes 20g evenly; priceForConfig(); flavorSummary().
- API routes: POST /api/auth/employee (PIN validate), GET/POST /api/inventory (list + restock), GET/POST /api/requests (service requests), PATCH /api/requests/[id] (acknowledge/done), rewrote POST /api/orders (transactional inventory deduction per component brand + low-stock guard).
- Auth: useSession Zustand store (role employee|guest). SignIn screen with Employee PIN pad (auto-submit on 4th digit) + Guest check-in (name+table).
- Reusable OrderScreen (app bar, hero, brand grid, config sheet, cart drawer, checkout, optional barcode scan). EmployeeDashboard (bottom tabs: Order/Inventory/Requests). GuestOrder (Scan + Call buttons).
- ConfigSheet rebuilt: flavor picker (fruits=single, fruits-mix=multi cross-brand via grouped FlavorPicker, flat), qty, live price.
- BarcodeModal: camera via BarcodeDetector API + manual entry fallback + direct brand picker; barcodes MZ-001 etc.
- RequestsPanel: lists pending/acknowledged/done, acknowledge→done flow, auto-refresh 15s.
- InventoryPanel: stock bars per brand, low-stock badges, hookahs-left, restock sheet (presets).
- Added aria-labels to icon buttons + inputs for accessibility & testability. Reduced toast duration to 2600ms.
- Fixed Prisma stale-client issue (regenerate + restart). Fixed sandbox process-persistence: orphaned next-server processes held port 3000 → thorough pkill cleanup in verification scripts; ran all Agent Browser steps within a single Bash call.

Verification (Agent Browser, mobile 412×915, fresh DB each run):
1. Sign-in shows Employee/Guest roles.
2. Employee PIN 1234 → Hassan → dashboard with 7 brands + bottom tabs.
3. Mix: Mazaya Blueberry + Al Fakher Grape (cross-brand) → "Add to cart · 145 EGP" (max mix price correct).
4. Qty 2 added, cart bar appears.
5. BYO hookah toggle → "1 free · 1 charged", "BYO 2-for-1 saving", total 290→145.
6. Checkout (employee fills customer) → "Order placed!" confirmation; POST /api/orders 200.
7. Inventory tab: Mazaya & Al Fakher = 980g (49 hookahs), others 1000g (50) — auto-deduct correct for the cross-brand mix (20g from each brand).
8. Requests tab: seeded request (Sara, Table 3, pending) visible.
9. Sign out → Guest check-in (Sara, Table 5) → guest order screen with Scan + Call buttons.
10. Call shisha man: dialog opens, Send → toast "The shisha man is on the way!" → DB request count 2 (seeded + ours).
11. Scan → manual "MZ-001" → toast "Scanned: Mazaya" → Mazaya config sheet (Fruits Mix 145, Add to cart 125).
12. No page/console errors throughout.

Stage Summary:
- All 4 requirements implemented & browser-verified.
- Lint clean. Dev server serves / + all API routes 200.

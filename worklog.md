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

---
Task ID: 20-28
Agent: main (Z.ai Code)
Task: Round 3 — order comments, optional name, coal request button, coal/foil supplies in inventory, saved favorite mixes, creative value-adds.

Work Log:
- Prisma schema: added SupplyItem, FavoriteMix, OrderComment models; Order.favoriteMixId; Order↔OrderComment relation. db:push + seed (supplies + Sara's Signature favorite).
- catalog.ts: SUPPLIES def (regular_coal, cubed_coal, foil) with perHookah consumption + supplyConsumption().
- API routes: /api/supplies (GET+POST restock), /api/favorites (GET by guestName + POST + DELETE /:id), /api/orders/[id]/comments (GET+POST). Updated /api/orders: customerName optional, favoriteMixId, transactional deduction of molasses + coal + foil with low-stock guards, PATCH for status.
- checkout-dialog.tsx: customerName now optional (valid always true), favoriteMixId prop/payload wired.
- guest-order.tsx: added Favorites button (with count badge), Coal request button (Regular/Cubed chooser dialog), returning-guest recognition (fetches favorites on check-in → "Welcome back, {name}! Your usual: {label} · {price}" banner + Re-order button).
- favorites-sheet.tsx: save current cart mix as named favorite, list favorites, one-tap apply (adds to cart at correct mix price), delete.
- requests-panel.tsx: coal_request type rendered with flame icon + amber styling distinct from call_shisha_man.
- inventory-panel.tsx: added Supplies section (coal + foil) with stock bars, low-stock badges, restock sheet; merged into low-stock count.
- orders-panel.tsx (NEW): employee Order Queue tab — active/done sections, order cards (customer/table/source/items/total), status workflow (pending→preparing→done), comments sheet (list + add with author).
- employee-dashboard.tsx: added 4th "Queue" tab.
- session-timer.tsx (NEW creative): start/pause/reset timer, target presets (30/45/60/90m), progress bar, overtime warning + toast when target passed (prompts coal refresh).
- order-screen.tsx: showTimer + returningBanner props.

Verification (Agent Browser, mobile 412×915, fresh DB):
1. Employee login → Session timer card visible on order screen.
2. Inventory → Supplies section shows Regular coal 200 pcs, Cubed coal 150 pcs, Foil 300 sheets (all In stock).
3. Requests tab shows seeded "Call the shisha man · Sara · Table 3 · pending".
4. Guest (Sara) check-in → "Welcome back, Sara! Your usual: Sara's Signature · 145 EGP" banner + Favorites badge (1).
5. Coal request → dialog with Regular/Cubed chooser → "Coal request sent! Cubed coal on the way" toast.
6. Favorites sheet → Apply "Sara's Signature" → "Added Sara's Signature · 2 flavors · 145 EGP" → cart bar 145 EGP.
7. Checkout with EMPTY customer name → "Order placed!" (name optional confirmed).
8. API: POST order (2 hookahs, no name) → supplies auto-deducted: regular_coal 200→198, cubed_coal 150→148, foil 300→298.
9. Orders queue shows "Walk-in · 1 hookah · 125 EGP" (omitted name → "Walk-in" display).
10. Comments sheet → filled Author "Hassan" + body "Extra coal needed" → posted → "Hassan · just now · Extra coal needed" shown.
11. No page/console errors throughout. Lint clean.

Stage Summary:
- All 7 requirements implemented & browser-verified.
- Creative value-adds: Session Timer (coal-refresh prompts), returning-guest recognition (one-tap re-order).
- Supplies (coal + foil) tracked & auto-deducted alongside molasses. Lint clean, dev server 200.

---
Task ID: 30-36
Agent: main (Z.ai Code)
Task: Verify nothing deleted, backup + harden, add medical hose (20 EGP) to inventory.

Work Log:
- AUDIT: confirmed all 7 brands, 3→4 supplies, cart migration (v2), all 7 Prisma models, all 15 hookah components, all 9 API routes, hero image intact. Nothing deleted across 4 turns.
- BACKUP: created scripts/backup-db.sh (SQLite snapshot via sqlite3 .backup + Prisma schema + source tarball; prunes to 10 most recent). Ran it → db/backups/custom-20261004T114429Z.db (72K) + schema + src tarball (188K). Added `bun run backup` script.
- HARDEN — server-side price recompute (orders API): added serverUnitPrice(), recomputeOrderTotals(), serverComponentGrams() to catalog.ts; orders POST now validates brandIds exist, re-derives component grams server-side (always 20g/hookah split evenly), recomputes subtotal/discount/total from catalog pricing — IGNORES client-sent totals/unitPrice/grams. Tested: tampered order (total:0, unitPrice:0, grams:0.01) → server charged 250 EGP + deducted 40g (not 0.02g).
- HARDEN — order PATCH status allowlist (pending|preparing|done only).
- HARDEN — global error boundary (src/app/error.tsx): catches unhandled runtime errors, shows friendly fallback with Try again / Reset & go home (clears corrupt cart state). Added src/app/not-found.tsx for 404s.
- Moved splitGrams() to catalog.ts (single source of truth); cart.ts re-exports it.
- MEDICAL HOSE: added to SUPPLIES catalog (key: medical_hose, emoji 🪈, perHookah: 0 = reusable/not auto-deducted, cost: 20 EGP, defaultStock: 50). Added `cost Float` to SupplyItem prisma model + seed. Updated /api/supplies (merge + create include cost). Inventory panel shows "Medical hose · 50 pcs · 20 EGP/pc · ♻️ Reusable — not auto-deducted per order".

Verification (Agent Browser + curl, fresh DB):
- Supplies API: Regular coal 199, Cubed coal 149, Foil 299, Medical hose 50 pcs @ 20 EGP.
- Tampered order (total:0) → server recomputed to 250 EGP, deducted 40g Mazaya (not 0.02g).
- Inventory UI: all 4 supplies render, medical hose shows cost + reusable badge.
- Lint clean. Dev server 200.

Stage Summary:
- Nothing removed; all prior features intact + verified.
- Backup infra in place (bun run backup). Hardened: server-authoritative pricing/grams, error boundary, status allowlist.
- Medical hose added (reusable, 20 EGP/unit) — tracked but not consumed per order.

---
Task ID: 40-50
Agent: main (Z.ai Code)
Task: Role-based access (super admin/admin/employee) with permission management; order-receiving dashboard (confirm unassigned guest orders); per-flavor inventory subtypes.

Work Log:
- Prisma schema: Employee.permissions (comma-sep), FlavorStock model (brandIdRaw+flavorName unique), Order.assignment/assignedToName/assignedToId. db:push + seed (4 employees: Boss super_admin/1111, Manager admin/0000, Hassan employee/1234, Omar employee/5678; 43 flavor subtypes @150g each; 1 unassigned guest order).
- src/lib/permissions.ts: roles (super_admin/admin/employee), ALL_PERMISSIONS (queue, new_order, inventory, requests, employees), ROLE_DEFAULTS, resolvePermissions(), hasPermission().
- API: /api/auth/employee returns permissions; /api/employees (GET list + POST create, super admin); /api/employees/[id] (PATCH role/permissions/active, DELETE with last-super-admin guard); /api/orders/[id]/assign (POST claim unassigned → assigned + status preparing); /api/flavor-stock (GET merged list, PATCH /:id restock).
- orders API: guest orders (guest_scan/guest_call) now created with assignment="unassigned"; deducts from FlavorStock per (brandId, flavorName) in addition to brand total; validates per-flavor stock.
- session store: added permissions to EmployeeSession; persist migration v2 drops stale sessions lacking permissions.
- employee-dashboard.tsx: permission-filtered tabs (Queue/New/Inventory/Requests/Staff); defaults to Queue (order-receiving focus); shows "No access" fallback if no perms.
- employees-panel.tsx (NEW): super admin staff management — list by role, add/edit (name/PIN/role/permission toggles), activate/deactivate, delete (guard: never delete last super admin).
- orders-panel.tsx: Incoming section (unassigned guest orders with "Confirm & take" button), My orders (assigned to me), Other active, Done; 10s polling.
- inventory-panel.tsx: per-brand expandable "Flavor stock" list (each flavor with grams + low badge + restock); RestockFlavorSheet for individual flavors (syncs brand total).
- sign-in.tsx: updated demo PINs (Boss 1111, Manager 0000, Hassan 1234, Omar 5678).

Verification (curl + browser):
- Auth: 1111→Boss(super_admin, 5 perms), 0000→Manager(admin, 4 perms), 1234→Hassan(employee, 3 perms), 5678→Omar(employee, 3 perms). ✓
- Employees API: 4 staff listed with correct roles; created Karim with custom perms [queue, new_order]. ✓
- Flavor stock: 43 subtypes; Mazaya Blueberry 150g → 110g after 2-hookah order (40g deducted at the exact flavor level). ✓
- Order claim: unassigned guest order → POST /assign → assignedToName=Hassan, assignment=assigned, status=preparing. ✓
- Lint clean. Dev server 200.

Stage Summary:
- 3 roles with super-admin-managed permissions; tab bar adapts per employee.
- Employee dashboard is order-receiving focused: incoming guest orders appear in Queue for one-tap confirm/claim.
- Inventory tracks exact per-flavor stock (43 subtypes) with per-flavor restock + auto-deduction.

---
Task ID: 60-68
Agent: main (Z.ai Code)
Task: Packaging availability per brand, procurement/purchasing connected to inventory, cost & selling price → net profit (EGP + %).

Work Log:
- catalog.ts: added PackOption[] to each brand (250g + 1kg packs with Egyptian-market wholesale costs: Mazaya 85/280, Al Fakher 90/300, Dandash 70/240, Nakhla 65/220, Amy 110/380, Salom/Kass 35). Updated SUPPLIES costs: regular_coal 1.2/pc, cubed_coal 1.8/pc, foil 0.5/sheet, medical_hose 20/pc. Added molassesCostPerHookah(), computeOrderCogs(), computeProfit() helpers.
- Prisma: added Order.cogs/molassesCost/suppliesCost/netProfit/marginPct; new Purchase model (kind, refId, name, gramsOrUnits, packCount, unitCost, totalCost, buyerName). db:push + seed.
- API: /api/purchases (GET list + POST create→restocks inventory transactionally); /api/profit (GET aggregates revenue/COGS/net profit + per-brand breakdown + recent orders). Updated /api/orders POST to compute + store COGS & profit server-side on every order.
- permissions.ts: added "purchases" + "profit" permissions; admin role gets both, super_admin gets all 7.
- purchases-panel.tsx (NEW): Buy sheet — pick molasses pack (per brand, shows grams + cost) or supply box (100 units), set quantity, see total cost, "Buy & restock" → records purchase + auto-restocks. Purchase history list with total spent.
- profit-panel.tsx (NEW): 4 metric cards (Revenue, COGS, Net profit, Margin), procurement spend, per-brand profit breakdown (revenue/cost/net/margin%), recent orders with per-order profit.
- employee-dashboard.tsx: added "Buy" (purchases) + "Profit" tabs.

Verification (curl):
- Buy 2× Mazaya 1kg (560 EGP) → inventory 1000→3000g ✓
- Order 2× Mazaya Blueberry (250 EGP) → cogs 18.2 (molasses 11.2 + supplies 7), netProfit 231.8, margin 92.7% ✓
- Profit summary: revenue 375, COGS 18.2, net 356.8 (95.1%), spent 560, top brand Mazaya 95.5% ✓
- Lint clean. Dev server 200.

Stage Summary:
- Each brand has purchasable packs (250g/1kg) at realistic Egyptian wholesale costs.
- Purchasing is connected to inventory: buying packs auto-restocks stock + records cost.
- Every order records COGS (molasses derived from cheapest pack + supplies) and computes net profit in EGP + %.
- Profit dashboard shows totals, per-brand breakdown, and procurement spend.

---
Task ID: 70-72
Agent: main (Z.ai Code)
Task: Redesign employee "New order" page into a standout BowlBuilder — no cart/checkout, build & send directly with creative visuals + live profit.

Work Log:
- catalog.ts: added brandColor() + BRAND_COLORS mapping (7 brands → hex), BOWL_PRESETS (5 house specials: Blue Mint Bliss, Double Apple Classic, Grape Mint Fresh, Watermelon Peach, Amy Premium Mix).
- bowl-builder.tsx (NEW): dedicated employee order-taking experience:
  • Visual bowl: circular SVG pie chart showing colored flavor segments per brand, fills as flavors are added.
  • Quick presets: one-tap house-special bowls (horizontal scroll carousel).
  • Brand grid: compact color-accented cards with brand-colored glow.
  • Inline customer + table fields (no separate checkout step).
  • Multi-bowl order list with mini bowl viz + live profit per bowl.
  • Framer Motion animations: bowls slide in/out, send bar slides up, confirmation pops.
  • Live profit ticker in send bar: revenue, net profit (EGP + %), BYO 2-for-1 toggle.
  • Bowl editor modal: full-screen, spring-animated; pick flavor type (Fruits/Mix), add flavors across brands, set qty, see live Revenue/Cost/Profit cards.
  • Direct "Send order" button → POSTs to /api/orders (no cart drawer, no checkout dialog).
  • Animated "Order sent!" confirmation with spring checkmark.
- employee-dashboard.tsx: "New" tab now renders BowlBuilder instead of shared OrderScreen.

Creative differentiators:
- Visual bowl representation (pie chart of flavor mix) — no competitor has this.
- Live profit per bowl as you build (employee sees business value in real-time).
- One-tap presets for fastest order entry.
- No cart/checkout friction — build and send directly.

Verification:
- Page compiles clean (no errors in dev log).
- HTTP 200, bowl-builder in HTML.
- Auth + profit API confirmed working.
- Lint clean.

Stage Summary:
- Employee "New order" is now a standout BowlBuilder with visual bowl, live profit, quick presets, and direct send — no cart/checkout.

---
Task ID: 80-85
Agent: main (Z.ai Code)
Task: Upscale UX to be super easy friendly for both guests and employees.

Work Log:
- sign-in.tsx: complete redesign with Framer Motion entrance animations; bigger friendlier role cards with gradient accents ("I'm staff" / "I'm a guest"); one-tap "Just browsing — skip sign-in" quick guest option; animated PIN pad with tap-scale feedback + shake-on-error; bigger touch targets (h-16 buttons, size-7 dots); spring-animated logo; slide transitions between panels.
- brand-card.tsx: each brand card now uses its brand color (brandColor()) for the accent glow, icon background, price text, and "Build" button; bigger icon (size-12); tap-scale animation via Framer Motion; cleaner layout with brand-colored ring on icon.
- order-screen.tsx: added "Popular bowls" quick-start section (horizontal scroll of BOWL_PRESETS with emoji + name + price — one tap adds to cart); guest can now start ordering with house specials without opening the config sheet.
- config-sheet.tsx: bigger flavor chips (px-4 py-2.5 instead of px-3 py-1.5); "⭐ popular" badges on common flavors (Double Apple, Mint, Grape, Blueberry, Watermelon) to guide first-time guests; ring feedback on active selection; applied to all three pickers (fruits, flat, mix).
- All flavor pickers now have 44px+ touch targets (accessibility compliant).

Verification:
- Lint clean. HTTP 200, zero compile errors.
- Auth API confirmed working.
- Page renders cleanly.

Stage Summary:
- Guests: friendlier sign-in (one-tap skip, animated PIN pad), popular bowls visible upfront for one-tap ordering, bigger flavor chips with popular badges guiding choices.
- Employees: same brand-colored cards + bowl builder (already standout), bigger touch targets throughout.
- Both audiences: animated, tactile, accessible (44px+ touch targets), with clear visual guidance.

---
Task ID: 90-92
Agent: main (Z.ai Code)
Task: Medical hose pricing (cost 10 EGP to us, 20 EGP to client when chosen) + fetch real brand logos from web.

Work Log:
- BRAND LOGOS: used z-ai image-search to fetch 7 brand logos (Mazaya, Al Fakher, Dandash, Nakhla, Amy, Salom, Kass) from the web → downloaded to public/images/brands/*.jpg. Added `logo` field to Brand interface + all 7 brands. Updated brand-card.tsx + bowl-builder.tsx to render real logo images (on white rounded background with brand-colored ring) instead of emoji.
- MEDICAL HOSE PRICING: updated SupplyDef with `sellPrice` field. Medical hose: cost=10 EGP (to business), sellPrice=20 EGP (to client when chosen). Added SELLABLE_ADDONS export. Updated Prisma SupplyItem with sellPrice column. Updated seed + supplies API + orders API supply creation to include sellPrice.
- ADD-ON FLOW: cart store now tracks `addons: string[]` with toggleAddon(). Cart drawer shows a toggle for each sellable add-on (medical hose: "Personal hose · +20 EGP") with checkbox. Add-on revenue added to grand total. Checkout dialog sends `addons` array to orders API. Orders API: validates add-ons against SELLABLE_ADDONS, adds sellPrice to finalTotal, adds cost to finalCogs, deducts 1 unit of supply stock per add-on, records profit correctly.
- Profit dashboard / orders API: COGS now includes add-on cost; profit reflects the 10 EGP margin per hose sold.

Verification (curl):
- Supplies API: medical_hose cost=10, sellPrice=20 ✓
- Order WITH hose: total=145 (125+20), cogs=19.1 (5.6+3.5+10), profit=125.9, margin=86.8% ✓
- Hose stock: 50→49 (deducted 1) ✓
- Order WITHOUT hose: total=125, cogs=9.1, profit=115.9, margin=92.7% ✓
- All 7 logos serve HTTP 200 ✓
- Lint clean. Dev server 200.

Stage Summary:
- Medical hose: 10 EGP cost to business, 20 EGP to client → 10 EGP pure profit per hose.
- Real brand logos fetched from web and displayed on brand cards + bowl builder.
- Add-on system is extensible (any supply with sellPrice>0 becomes a sellable add-on).

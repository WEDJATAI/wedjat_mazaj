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

# Mazaj Hookah Platform

A production-grade hookah ordering system for Egyptian lounges, integrated with the Wedjat RSM restaurant POS.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub (Source)                          │
│                   WEDJATAI/wedjat_mazaj                         │
│                        ↓ push triggers                          │
├─────────────────────────────────────────────────────────────────┤
│                     Vercel (Hosting)                            │
│                   wmazaj.vercel.app                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Next.js 16  │  │ API Routes    │  │ Inngest /api/inngest  │  │
│  │ App Router  │  │ (serverless)  │  │ (background jobs)     │  │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                │                      │              │
│         │    ┌───────────┘                      │              │
│         ▼    ▼                                   ▼              │
├─────────────────────────────────────────────────────────────────┤
│              Neon PostgreSQL (Primary DB)                       │
│    Orders · Employees · Inventory · Supplies · Purchases       │
│    Favorites · Service Requests · Comments                      │
│    (connection-pooled for serverless)                           │
├─────────────────────────────────────────────────────────────────┤
│              Wedjat RSM Turso (Restaurant POS)                  │
│    Products · Tables · Orders · Audit Logs                      │
│    (order sync, price sync, revocation detection)               │
├─────────────────────────────────────────────────────────────────┤
│              Mazaj Turso (Edge Replica)                         │
│    (fast edge reads — reserved for future use)                  │
├─────────────────────────────────────────────────────────────────┤
│              Inngest (Background Jobs)                           │
│  • Revocation polling — every 2 minutes                         │
│  • Failed sync retries — every 5 minutes                        │
│  • Price sync to Wedjat — every hour                            │
│  • Daily profit digest — 11 PM Cairo time                       │
└─────────────────────────────────────────────────────────────────┘
```

## Stack

| Service | Purpose | Why |
|---------|---------|-----|
| **Neon PostgreSQL** | Primary database | Serverless, pooled connections, branching |
| **Inngest** | Background jobs | Cron schedules, retries, durability |
| **Vercel** | Hosting | Serverless, edge, auto-deploy from GitHub |
| **GitHub** | Source control | CI/CD trigger for Vercel |

## Features

- **Employee POS**: PIN sign-in, 3 roles (super_admin/admin/employee), permission management
- **Bowl Builder**: Visual pie-chart bowl, live profit, quick presets, direct send
- **Guest ordering**: Barcode scan, favorites, coal requests, call shisha man
- **Inventory**: Per-flavor stock subtypes, supplies (coal/foil/hose), auto-deduction
- **Procurement**: Buy molasses packs, cost tracking, profit dashboard (EGP + %)
- **Wedjat RSM sync**: Idempotent order push onto table CHECKS (house prices), catalog + availability mirror, revocation polling — all through the restaurant's key-authenticated integration API (never its databases directly)
- **Full Arabic version**: RTL layout, 180+ translations, language toggle
- **Server-side hardening**: Price recompute, status allowlist, error boundary

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in credentials
3. `bun install`
4. `bun run db:push` (creates schema on Neon)
5. `bun run db:seed` (seeds employees, inventory, supplies)
6. `bun run dev`

## Deployment (Vercel)

1. Import the GitHub repo on Vercel
2. Set all environment variables (see `.env.example`)
3. Deploy — Vercel auto-builds with `prisma generate && next build`
4. Connect Inngest dashboard to `https://wmajaj.vercel.app/api/inngest` (one-time: Inngest → Apps → Add app — powers the scheduled retry/revocation/menu-sync jobs; orders sync inline without it)

## Demo PINs

- Boss (super_admin): `1111`
- Manager (admin): `0000`
- Hassan (employee): `1234`
- Omar (employee): `5678`

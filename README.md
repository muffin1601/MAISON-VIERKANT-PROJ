# Maison Vierkant India

Production-grade Next.js 15 SaaS rebuild of the Maison Vierkant India commerce platform
(curated by Watcon) — luxury B2B/B2C reseller of Atelier Vierkant clay vessels.

> Planning docs (SRS, ERD, API spec, folder structure, dev plan) live in the repo root `../docs/`.

## Stack
Next.js 15 (App Router) · TypeScript · PostgreSQL · Prisma · Supabase · NextAuth · React Query ·
Zustand · Zod · React Hook Form · Framer Motion · SCSS Modules · Docker · Vitest · GitHub Actions.

## Build phases
1. **Architecture & Database** ← _current_
2. Authentication & RBAC
3. Admin Dashboard
4. Product Management (+ server-side PDF/AI ingest)
5. Pricing Engine
6. Orders & Checkout
7. CRM · Quotes · Purchase Orders
8. Testing & Deployment

## Getting started (local)

### Option A — Supabase (target setup)
1. Copy env: `cp .env.example .env` and fill `DATABASE_URL` / `DIRECT_URL` from your Supabase project.
2. Install: `npm install`
3. Migrate & seed:
   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```
4. Run: `npm run dev` → http://localhost:3000

### Option B — Local Postgres via Docker
```bash
docker compose up -d db
# .env: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maison_vierkant
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `typecheck` | ESLint / TypeScript checks |
| `npm run test` | Vitest |
| `npm run db:seed` | Seed catalogue (82 series / 460+ models), roles, users, projects, orders |
| `npx prisma studio` | Inspect the database |

## Seed credentials (Phase 1 placeholders)
Demo users are seeded with role assignments; real password hashing is wired in **Phase 2**.
`superadmin@watcon.net`, `admin@watcon.net`, `sales.manager@watcon.net`, `sales@watcon.net`,
`inventory@watcon.net`.

## Data provenance
`prisma/data/catalogue.ts` is auto-extracted from the original prototype (`../index.html.html`,
lines 1487–1782) and preserves exact EUR prices, dimensions, finishes, and stock.

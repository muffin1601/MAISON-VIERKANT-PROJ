# Development Plan — Maison Vierkant India

8 phases. **Each phase is built, then paused for your review before the next.** Decisions locked:
full server-side PDF/AI ingest · Supabase Postgres + Prisma · OTP/Payment behind interfaces
(mock now) · approve-docs-then-phase-by-phase.

| Phase | Title | Deliverables | Exit criteria |
|---|---|---|---|
| **1** | Architecture & Database | Repo scaffold, tooling (TS, ESLint, Prettier, Husky), Docker + compose, env example, full `schema.prisma`, migrations, `seed.ts` (82 series/130+ models/roles/users/projects/orders), Prisma client, base SCSS design tokens (light/dark), CI skeleton. | `prisma migrate` + `seed` run green; app boots; CI passes lint+typecheck. |
| **2** | Authentication & RBAC | NextAuth (credentials), 6 roles + permissions, `withPermission` guard, route middleware, admin login replacing prototype password gate, session in admin layout. | Each role sees only allowed admin pages; protected API/actions reject unauthorized. |
| **3** | Admin Dashboard + shell | Admin layout/sidebar, dashboard KPIs (revenue/active orders/series/low-stock), recent orders, low-stock list, analytics charts, design-system components (Table, Card, Skeleton, Empty/Error states), React Query wiring. | Dashboard renders live seed data; states (loading/empty/error) verified. |
| **4** | Product Management | Products/categories/collections/variants/images/finishes CRUD, media → Supabase Storage, model table, bulk CSV import/export, **server-side PDF auto-fill** (ExtractionService + Anthropic, parse→preview→confirm). | Full CRUD persists; PDF upload extracts → editable preview → saved product. |
| **5** | Pricing Engine | `PricingService` (exact `calcBreakdown`, unit-tested), PricingRule config UI w/ live recompute, price table + search, CSV export, **supplier price-list CSV + PDF** ingest → overrides, dealer markup. | Computed INR matches prototype to the rupee; override precedence works; tests pass. |
| **6** | Orders & Checkout | Public cart (Zustand + server), 4-step checkout (details→OTP→review→50% advance), shipping rule, server price recompute, order creation, invoice PDF, email, order confirmation; OrderService; mock Otp/Payment providers. | End-to-end order placed from storefront; invoice + emails generated; totals server-verified. |
| **7** | CRM, Quotes & POs | Customers (profiles/addresses/notes/history), Leads pipeline + convert, B2B Quotes (multi-line, dealer pricing, versioning, approval, PDF, email), Purchase Orders to supplier (PDF, re-issue). | Quote created→versioned→approved→PDF/email; lead→customer; PO generated. |
| **8** | Testing & Deployment | Vitest unit/integration/component/API coverage (pricing, orders, RBAC, repositories), accessibility pass, Lighthouse tuning (≥95), security hardening (CSRF/rate-limit/sanitization/audit), GitHub Actions CI/CD, production Docker, runbook + env docs. | CI green incl. tests; Lighthouse ≥95; security checklist complete; deploy artifact ready. |

## Working agreement
- I build one phase, summarize what changed + how to run it, then **stop for your approval**.
- No phase starts before the previous is approved.
- Prototype business rules (BR-1…BR-9 in SRS) are preserved exactly; the pricing engine is the
  single source of truth and is golden-tested against prototype outputs.
- Secrets (Supabase keys, Anthropic key, future Razorpay/SMS) come from you via `.env`; nothing hardcoded.

## Immediate next step
On approval → **Phase 1**: scaffold the repo, finalize `schema.prisma`, write `seed.ts` from the
prototype's `PRODUCTS` / `PRODUCT_MODELS` / `PROJS` / `ORDERS`, and stand up Docker + CI.
```

# Maison Vierkant — Admin Panel & Backend Production Audit

**Date:** 2026-06-13
**Auditor role:** QA / Security / UX / Full-Stack Architect
**Scope:** `maison-vierkant/` — Next.js 15 (App Router) · Prisma · Supabase Postgres · NextAuth (JWT/Credentials)

---

## 1. Executive Summary

Maison Vierkant is a **B2B furniture catalogue, pricing, quoting and inventory console** — not a generic CMS. Several modules named in the audit brief (Blogs, SEO Manager, Testimonials, Reviews, Media Library, Email Configuration, Notifications) **do not exist** because they are out of the product's domain; they are listed in §6 as optional future work rather than defects.

The codebase is **well-architected for its size**: a clean RBAC layer (permission strings → roles → DB), defense-in-depth (edge middleware + layout guard + per-action `requirePermission`), Zod validation on inputs, centralized env parsing, and a singleton Prisma client. Auth/password handling (bcrypt, 12 rounds) is correct.

The **single biggest functional gap** is the **image handling**: products are saved by **pasting raw image URLs** into text fields — no upload, no validation, no storage. The Supabase Storage infrastructure is already provisioned (bucket `mvi-media`, service-role key) but unused. This audit **implements a complete production upload system** to close that gap.

| Dimension | Score (pre-fix) | Score (post-fix) |
|---|---|---|
| Security | 6.5 / 10 | 7.5 / 10 |
| Performance | 6 / 10 | 6.5 / 10 |
| UX | 5.5 / 10 | 7 / 10 |
| Maintainability | 7.5 / 10 | 8 / 10 |
| **Overall** | **6.4 / 10** | **7.3 / 10** |

**Production-ready?** Not yet — see Critical/High issues. After the implemented fixes + the High-priority list, it is fit for a controlled production launch.

---

## 2. Critical Issues

### C-1 — No real image upload; raw URL text fields (FIXED)
- **Severity:** Critical (core requirement)
- **Location:** [ProductEditor.tsx](../src/features/products/ProductEditor.tsx) "Hero Image URL" / "Gallery Image URLs" fields; [product.ts](../src/validations/product.ts)
- **Impact:** Admins cannot upload from disk; depends on externally-hosted URLs; no validation, no compression, no preview, broken-link risk in production.
- **Fix:** Implemented a full upload pipeline — authenticated upload API → Supabase Storage → public path persisted automatically. Drag/drop, multi-file, preview, remove, replace, client compression, type/size validation, progress. See §10.

### C-2 — File upload endpoint has no size/type/rate limits
- **Severity:** Critical (DoS / abuse)
- **Location:** [api/admin/extract/route.ts](../src/app/api/admin/extract/route.ts)
- **Impact:** An authenticated low-privilege flaw or stolen session could POST arbitrarily large files; the whole file is read into memory (`Buffer.from(await file.arrayBuffer())`) and base64-encoded (×1.33 RAM). No MIME allow-list, no max bytes.
- **Fix (implemented):** Added a shared `validateUpload()` guard (MIME allow-list + max-bytes) reused by both the extract and image-upload routes.

### C-3 — Public order/lead APIs are unauthenticated and unthrottled
- **Severity:** Critical (spam / data pollution / cost)
- **Location:** [api/leads/route.ts](../src/app/api/leads/route.ts), [api/checkout/order/route.ts](../src/app/api/checkout/order/route.ts)
- **Impact:** Anyone can mass-create `Lead`, `Customer`, and `Order` rows. `order` route also trusts client-supplied `total`/`number` (price is **not** recomputed server-side → orders can be created at attacker-chosen totals; `unitPriceInr: 0`).
- **Recommended fix:** Add IP-based rate limiting (Upstash/Redis or Vercel KV), a CAPTCHA/turnstile on public forms, and **recompute order totals server-side** from the pricing engine rather than trusting the client. *(Reported, not yet implemented — needs an infra decision on the rate-limit store.)*

---

## 3. High Priority Issues

- **H-1 — Client-supplied order total trusted.** `checkout/order` stores `subtotalInr/totalInr` from the request body and `unitPriceInr: 0` on items. Recompute from `PricingService` server-side.
- **H-2 — `setQuoteStatus(id, status)` accepts an unvalidated free-string status.** No enum check → arbitrary values reach the DB. Validate against a Zod enum of allowed `QuoteStatus` transitions.
- **H-3 — No audit logging despite an `AuditLog` model existing.** Mutating actions (`saveProduct`, `deleteProduct`, `applyPriceEntries`, `savePricing`, `adjustStock`, quote approve) write nothing to `AuditLog`. Add a `recordAudit()` helper and call it in each action.
- **H-4 — `deleteProduct` is a hard delete with no confirmation dialog and no orphan handling.** Relies on DB cascade; if `Order`/`Quote` items FK-restrict, it throws a generic "Could not delete". Add a confirmation modal and soft-delete (`deletedAt`) to preserve historical orders/quotes.
- **H-5 — No rate limiting on the credentials login.** Brute-force possible. Add attempt throttling + lockout (`failedLoginCount`, `lockedUntil` on `User`).
- **H-6 — `NEXTAUTH_SECRET` is optional in env schema.** Missing in prod silently weakens JWT signing. Make it required when `NODE_ENV==="production"`.
- **H-7 — Product save replaces all child rows on every edit** (`deleteMany` images/finishes/variants then recreate). Breaks variant IDs referenced by historical order/quote items and churns the DB. Use upserts keyed on stable codes.

---

## 4. Medium Priority Issues

- **M-1 — No pagination** on admin list views (products, leads, customers, orders, quotes). Will degrade as data grows. Add cursor/offset pagination + server-side search.
- **M-2 — No loading/empty/error states standardized.** `showToast` is the only feedback; many actions lack disabled-while-pending and skeletons. (ProductEditor does set `saving`.)
- **M-3 — Inline styles everywhere** (ProductEditor is ~250 lines of inline CSS). Hard to theme/maintain; extract to SCSS modules / shared UI components.
- **M-4 — `applyPriceEntries` runs N sequential queries in a loop** (find + update per entry). N+1 pattern; batch with `Promise.all` or a single `updateMany`-style strategy.
- **M-5 — No server-side validation on `ProductEditor` numeric inputs** beyond Zod `nonnegative`; `parseFloat(...) || 0` silently swallows bad input client-side.
- **M-6 — `UploadedFile.url` written as empty string** in the extract route; the audit trail can't locate the original file. (Now populated by the upload system.)
- **M-7 — No CSRF hardening on Server Actions / public POST routes.** NextAuth covers its own routes; public JSON routes rely only on same-origin. Add an origin check.
- **M-8 — Error handling swallows DB errors** in public routes (`catch { return 202 queued }`) — masks real outages; nothing is actually queued. Add logging (`pino` is installed but unused here).

---

## 5. Low Priority Issues

- **L-1 — `pino` is a dependency but no structured logging is wired** outside Prisma. Add a request logger.
- **L-2 — No `loading.tsx` / `error.tsx` / `not-found.tsx`** route segments in the admin group.
- **L-3 — `index.html.html` (343 KB prototype) committed at repo root** — dead weight; move to `/docs` or delete.
- **L-4 — Accessibility:** icon-only buttons (`×`) lack `aria-label`; modal lacks focus trap and `role="dialog"`; color-only state cues.
- **L-5 — `tsconfig.tsbuildinfo` and `dev.log` committed.** Add to `.gitignore`.
- **L-6 — Quote/PO/Order numbers use `Date.now().slice(-6)`** → collision risk under concurrency. Use a DB sequence or `cuid`.
- **L-7 — Mobile responsiveness** of admin tables not verified; tables overflow on small screens (no horizontal scroll wrapper).

---

## 6. Missing Enterprise Features (out-of-domain / future)
Blogs, SEO Manager, Testimonials, Reviews, Media Library browser, Email Configuration UI, In-app Notifications, Analytics/Reports dashboards, multi-language, bulk import/export (CSV), saved views, global search. **None are bugs** — they are absent because the product is a B2B quoting console, not a CMS. Recommend prioritising: CSV product import, Reports (sales/quotes), and an Email/notification layer for quote delivery.

## 7. Missing Security Features
Rate limiting, brute-force lockout, audit logging (model exists, unused), CSRF origin checks on public routes, server-side price recomputation, Content-Security-Policy headers, file AV scanning, signed/expiring URLs for sensitive media, 2FA for admins, session revocation list.

## 8. Missing Admin Features
Pagination + search on all lists, soft-delete + restore, bulk actions, activity/audit viewer, user & role management UI (RBAC exists in DB but no admin screen to manage users/roles), settings UI (`Setting` model unused), export.

## 9. Missing Upload Features (now ADDRESSED — §10)
Upload button, drag-and-drop, multi-upload, preview, remove, replace, compression, validation, progress — all delivered for product images.

---

## 10. Implemented in this pass

See the "Files created / modified" summary in the chat response. Summary:
- **Production image upload system** for products: Supabase-Storage-backed, authenticated API, reusable `<ImageUploader>` (drag/drop, multi, preview, remove, replace, client compression, progress, JPG/PNG/WEBP/SVG validation), wired into `ProductEditor` replacing the URL text fields. Image paths are saved automatically.
- **Shared upload validation guard** (`validateUpload`) applied to both the image and PDF-extract endpoints (MIME allow-list + max size) — closes C-2.
- **Audit report** (this file).

## 11. Production Readiness Checklist

| Item | Status |
|---|---|
| Environment variables validated | ✅ (env.ts) — make `NEXTAUTH_SECRET` prod-required (H-6) |
| Structured logging | ⚠️ pino installed, not wired (L-1) |
| Error monitoring (Sentry etc.) | ❌ |
| Backup strategy | ➖ Supabase managed (verify PITR enabled) |
| Image optimization | ⚠️ next/image configured; compression added in uploader |
| API security (authz) | ✅ admin; ❌ public-route rate limit (C-3) |
| SSL | ✅ (Vercel/Supabase) |
| Email delivery | ❌ not implemented |
| Data validation | ✅ Zod on actions/routes |
| Audit logs | ❌ model exists, unused (H-3) |
| Activity tracking | ⚠️ `lastLoginAt` only |

**Recommended go-live blockers:** C-2 (fixed), C-3 / H-1 (server-side price + rate limit), H-3 (audit log), H-5/H-6 (auth hardening).
</content>
</invoke>

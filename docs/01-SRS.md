# Software Requirements Specification — Maison Vierkant India

**Product:** Maison Vierkant India (curated by Watcon) — luxury B2B/B2C commerce platform
**Source:** Reverse-engineered from `index.html.html` (4,876-line SPA prototype)
**Version:** 1.0 (pre-build) · **Date:** 2026-06-09

---

## 1. Purpose & Scope
A production-grade Next.js 15 SaaS platform that resells Atelier Vierkant (Belgium) handmade
clay vessels into the Indian market. It comprises a public storefront, a B2C checkout, a B2B
quotation system, a supplier purchase-order flow, and an internal admin/sales console driven by
a deterministic INR pricing engine over EUR base prices.

In scope: every screen, workflow, and business rule present in the prototype, re-engineered with
a real database, auth/RBAC, server-side pricing/PDF ingestion, payments behind interfaces, and
full DevOps. Out of scope (this release): multi-currency beyond EUR→INR, multi-warehouse logistics
optimization, and a customer self-service portal (customers are managed by staff).

## 2. Actors & Roles (RBAC)
Derived from `USERS` in prototype, extended per requirements.
- **Super Admin** — full access incl. settings, users, audit logs, pricing config.
- **Admin** — all operational pages (dashboard, pricing, products, stock, orders, leads, customers, quotes, saved quotes, purchase orders).
- **Sales Manager** — customers, quotes (create/approve), saved quotes, leads, orders (read).
- **Sales Executive** — customers, quotes (create), saved quotes, leads. (= prototype `sales` role)
- **Inventory Manager** — stock, inventory transactions, low-stock alerts, products (read).
- **Customer** — public storefront + own cart/checkout/order confirmation (no console access).

Authorization is enforced at four layers: API routes, dashboard routes (middleware), Server
Actions, and repository/service operations.

## 3. Functional Requirements

### 3.1 Public Website
- **FR-PUB-1 Home** — hero, featured series grid (`home-products`), project gallery strip, catalogue CTA, trade/concierge blocks.
- **FR-PUB-2 Collection (Shop)** — full catalogue with dynamic filter row by series group; SSR + image optimization.
- **FR-PUB-3 Product Detail** — image gallery + thumbs, series chips, model table (code/dims/price), finish picker (3 tiers), quantity stepper, add-to-cart. Price shown in INR via pricing engine.
- **FR-PUB-4 Projects Gallery** — curated installations (loc/name/desc/img), 6 seeded.
- **FR-PUB-5 About / Atelier** — editorial content ("38 series / 200+ models", clay bodies, finishes).
- **FR-PUB-6 Contact** — inquiry form → Lead.
- **FR-PUB-7 Catalogue Request** — modal lead-capture (name/email/phone/type/company) → Lead with source=catalogue.
- **FR-PUB-8 Search** — full-text across series/model code/description.
- **FR-PUB-9 Wishlist** — per-session/customer saved products.
- **FR-PUB-10 SEO** — dynamic metadata, OpenGraph, sitemap, structured data (Product schema), SSR.

### 3.2 E-Commerce / Cart & Checkout
- **FR-EC-1 Cart** — line = (product, model code, finish, qty); price via `getItemINR`; persists across session; cart badge count.
- **FR-EC-2 Checkout (4 steps)** — (1) Details + address; (2) Phone OTP verification; (3) Review order; (4) Payment of **50% advance**. Mirrors `CO_STEPS`.
- **FR-EC-3 Shipping rule** — Delhi-NCR (delhi/noida/gurgaon/faridabad/ghaziabad…) = free transport; else "transport on quote". Preserve keyword logic.
- **FR-EC-4 Tax/price** — all totals computed server-side through the pricing engine; never trust client.
- **FR-EC-5 Order creation** — order number `MVI-ORD-xxxxxx`, status lifecycle, customer auto-created/linked.
- **FR-EC-6 Confirmation + Invoice** — order confirmation screen + server-generated PDF invoice + email.
- **FR-EC-7 OTP & Payment** — behind `IOtpProvider` / `IPaymentProvider` interfaces; dev/mock impls now, MSG91/Twilio + Razorpay later.

### 3.3 Pricing Engine (core business logic)
- **FR-PRICE-1** — Deterministic INR computation, exact stages from `calcBreakdown`:
  `eur → ×(1-discount%) → ×rate → ×(1+transport%) → +packing(flat) → ×(1+duty%) → ×(1+gst%) → ×(1+profit%) → round`.
  Also `calcINRnoG` (pre-GST) and per-model pricing.
- **FR-PRICE-2 Config** — editable `PricingRule` set: rate(FX), discount%, transport%, packing(₹ flat), duty%, gst%, profit/margin%. Live recompute on change (mirrors `applyPricing`).
- **FR-PRICE-3 Dealer markup** — additional dealer/B2B markup % layer for quotes.
- **FR-PRICE-4 Supplier price-list upload** — CSV import (`handleCSV`) + **server-side PDF extraction via Anthropic API** → `UploadedFile` + per-product EUR override (`uploadedPx`).
- **FR-PRICE-5 Price table + export** — admin price table with search; CSV export (`dlSiteCSV`) of full INR breakdown.
- **FR-PRICE-6 Custom formula** — pluggable formula strategy per pricing rule set (versioned).

### 3.4 Admin Dashboard
- **FR-ADM-1 Dashboard** — KPIs: total revenue, active orders, #series, low-stock count; recent orders table; low-stock list. (`renderDash`)
- **FR-ADM-2 Analytics** — revenue over time, top series, lead funnel, order status breakdown.

### 3.5 Product Management
- **FR-PM-1 CRUD** products, categories (series groups), collections, images, variants (models), finishes/colours.
- **FR-PM-2 Media** — hero image, gallery, technical drawings (image/PDF) → Supabase Storage.
- **FR-PM-3 Model table** — per-product variant rows (code, eur, dims).
- **FR-PM-4 PDF auto-fill** — upload product sheet → server extracts fields → editable preview → confirm-save.
- **FR-PM-5 Bulk import/export** — CSV/Excel for products + models.

### 3.6 Inventory
- **FR-INV-1** stock per product (`stockL`), adjust ±, low-stock alert (≤2). **FR-INV-2** inventory transactions (history, reason, actor). **FR-INV-3** warehouse field. **FR-INV-4** adjustments audit.

### 3.7 Orders
- **FR-ORD-1** lifecycle: pending → confirmed → shipped → delivered (+ cancelled). **FR-ORD-2** status updates, tracking number, shipping mgmt. **FR-ORD-3** invoice generation. **FR-ORD-4** customer communication (email log).

### 3.8 Customers (CRM)
- **FR-CRM-1** profiles, **FR-CRM-2** order history, **FR-CRM-3** saved addresses, **FR-CRM-4** notes, **FR-CRM-5** lead linkage.

### 3.9 Quotes (B2B)
- **FR-Q-1** create quote, multi-line (`qLines`: product/model/finish/qty), billing + delivery address (same-as toggle). **FR-Q-2** dynamic pricing incl. dealer markup. **FR-Q-3** PDF generation + email. **FR-Q-4** approval workflow (draft→sent→approved/rejected). **FR-Q-5** versioning (mirrors `mvi_quotes` localStorage; `qCurrentId`). **FR-Q-6** saved-quotes list, re-issue.

### 3.10 Catalogue Lead System
- **FR-LEAD-1** capture (catalogue/contact/trade), **FR-LEAD-2** qualification, **FR-LEAD-3** status pipeline (new→contacted→qualified→won/lost), **FR-LEAD-4** CRM notes, **FR-LEAD-5** convert lead→customer.

### 3.11 Purchase Orders (to supplier)
- **FR-PO-1** create PO to Atelier Vierkant Belgium (EUR), multi-line, save/edit/re-issue, PDF. Mirrors `renderPOL`/purchase page.

### 3.12 Settings & Audit
- **FR-SET-1** company/tax/email/storage settings. **FR-AUD-1** audit log for every mutating admin action (actor, entity, before/after).

## 4. Non-Functional Requirements
- **Performance:** Lighthouse ≥95, optimized CWV, code-splitting, lazy loading, edge caching, `next/image`.
- **Security:** CSRF tokens, XSS/SQLi protection (Prisma + Zod), rate limiting, secure httpOnly cookies, input sanitization, audit logging, RBAC at all layers.
- **Accessibility:** WCAG 2.1 AA, keyboard nav, focus states, semantic markup.
- **UX:** responsive, dark/light themes, reusable design system, loading/empty/error states, skeletons.
- **Reliability:** transactional writes, idempotent order/payment, optimistic UI with rollback.
- **Observability:** structured logging, request tracing, error reporting.
- **i18n-ready:** currency/number formatting (`en-IN`), EUR↔INR.

## 5. Business Rules (exact, from prototype)
- BR-1 FX default rate = 93.50 INR/EUR (editable).
- BR-2 Packing is a **flat** ₹1,500 added after transport %, before duty.
- BR-3 Default duty 25%, GST 18%, transport 18%, profit 25%, discount 0%.
- BR-4 Delhi-NCR delivery = free transport; otherwise transport quoted separately.
- BR-5 Checkout advance = 50% of total.
- BR-6 Low-stock threshold = ≤2 units.
- BR-7 Finish tiers: BASIC(3) / STD(6) / ENGOBE(7, "on request").
- BR-8 EUR override (uploaded price list) takes precedence over product base `eurPrice`.
- BR-9 Order number format `MVI-ORD-` + 6 digits; PO and Quote get analogous prefixes.

## 6. Data Volume (seed)
82 series, 130+ models, 6 projects, 4 seed orders, 6 roles, demo users for each role.

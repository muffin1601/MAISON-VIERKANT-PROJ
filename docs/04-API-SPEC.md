# API Specification — Maison Vierkant India

Conventions: REST under `/api/*` for public + integration; **Server Actions** for admin mutations
(co-located in `features/*/actions`). All inputs validated with **Zod**; all responses
`{ data } | { error: { code, message, fields? } }`. Auth via NextAuth session; RBAC checked in a
`withPermission(perm)` guard. Rate limiting on auth, checkout, lead, upload, and OTP routes.

## Auth
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/api/auth/[...nextauth]` | public | NextAuth (Credentials + optional Supabase OAuth) |
| GET  | `/api/me` | session | current user + role + permissions |

## Public catalogue (REST, cached/SSR)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/products` | list; query `?category&collection&q&page&sort` |
| GET | `/api/products/:slug` | detail incl. variants, images, finishes, INR price |
| GET | `/api/categories` | series groups |
| GET | `/api/collections` | curated collections |
| GET | `/api/projects` | project gallery |
| GET | `/api/search?q=` | full-text products |

## Cart & Checkout
| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/cart` | server cart (session/customer) |
| POST | `/api/checkout/quote-shipping` | Delhi-NCR free vs quoted |
| POST | `/api/checkout/otp/send` | `IOtpProvider` (mock now) — rate-limited |
| POST | `/api/checkout/otp/verify` | verify code |
| POST | `/api/checkout/order` | create order (server price recompute, 50% advance) → `{ orderNumber }` |
| POST | `/api/payments/intent` | `IPaymentProvider` (mock now) advance intent |
| POST | `/api/payments/webhook` | provider webhook → mark Payment PAID |
| GET | `/api/orders/:number/invoice` | stream/download invoice PDF |

## Leads (public capture)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/leads` | catalogue/contact/trade capture → Lead (rate-limited, sanitized) |

## Admin — Server Actions (RBAC-guarded)
Grouped by feature; each has Zod schema + audit logging.
- **Products:** `createProduct`, `updateProduct`, `deleteProduct`, `upsertVariant`, `deleteVariant`, `addImage`, `reorderImages`, `setFinishes`, `bulkImport`, `bulkExport`.
- **PDF ingest:** `uploadProductSheet` → enqueue parse; `getParseResult`; `confirmParsedProduct`.
- **Pricing:** `getActivePricingRule`, `updatePricingRule`, `previewBreakdown(eur)`, `importPriceListCsv`, `uploadPriceListPdf` (server Anthropic extraction), `applyOverrides`, `exportPriceCsv`.
- **Inventory:** `adjustStock(productId, delta, reason)`, `listLowStock`, `inventoryHistory`.
- **Orders:** `listOrders`, `updateOrderStatus`, `setTracking`, `generateInvoice`, `emailCustomer`.
- **Customers:** `upsertCustomer`, `addAddress`, `addNote`, `customerOrders`.
- **Quotes:** `createQuote`, `updateQuote`, `addQuoteVersion`, `setQuoteStatus`(approval), `generateQuotePdf`, `emailQuote`, `listSavedQuotes`.
- **Leads:** `listLeads`, `updateLeadStatus`, `addLeadNote`, `convertLeadToCustomer`.
- **Purchase Orders:** `createPO`, `updatePO`, `reissuePO`, `generatePoPdf`.
- **Dashboard/Analytics:** `dashboardKpis`, `revenueSeries`, `leadFunnel`, `topProducts`.
- **Settings/Users:** `getSettings`, `updateSetting`, `listUsers`, `setUserRole`, `listAuditLogs`.

## Pricing engine contract (server, pure, unit-tested)
```ts
function calcBreakdown(eur: number, rule: PricingRule): {
  afterDisc; inrBase; withTransport; withPacking; withDuty; withGst; selling; // = final INR
}
// Stages (exact, from prototype):
// afterDisc = eur*(1-discount/100); inrBase = afterDisc*rate;
// withTransport = inrBase*(1+transport/100); withPacking = withTransport+packingFlat;
// withDuty = withPacking*(1+duty/100); withGst = withDuty*(1+gst/100);
// selling = round(withGst*(1+profit/100));  // dealerMarkup applied for quotes
```

## Cross-cutting
- **Validation:** Zod schemas in `validations/*`, shared client (RHF) + server.
- **Errors:** typed `AppError(code,message,status)`; global handler maps to JSON.
- **Logging:** structured (pino) with requestId; audit log on every mutation.
- **Rate limiting:** token-bucket (Upstash/Redis or in-memory dev) on listed routes.
- **Security:** CSRF on Server Actions, httpOnly secure cookies, input sanitization, Prisma parameterization.

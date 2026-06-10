# Folder Structure — Maison Vierkant India

Next.js 15 App Router · TypeScript · feature-based + repository/service layers · SCSS Modules.

```
maison-vierkant/
├── src/
│   ├── app/
│   │   ├── (public)/                # storefront route group
│   │   │   ├── page.tsx             # Home
│   │   │   ├── collection/
│   │   │   ├── products/[slug]/
│   │   │   ├── projects/
│   │   │   ├── about/
│   │   │   ├── contact/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   └── catalogue/           # catalogue request
│   │   ├── (admin)/admin/           # gated console route group
│   │   │   ├── dashboard/
│   │   │   ├── pricing/
│   │   │   ├── products/
│   │   │   ├── stock/
│   │   │   ├── orders/
│   │   │   ├── leads/
│   │   │   ├── customers/
│   │   │   ├── quotes/
│   │   │   ├── saved-quotes/
│   │   │   ├── purchase-orders/
│   │   │   └── settings/
│   │   ├── api/                     # REST routes (see API spec)
│   │   ├── layout.tsx
│   │   └── globals.scss
│   ├── components/                  # shared design-system (Button, Modal, Table, Toast, Skeleton…)
│   │   ├── ui/
│   │   └── layout/                  # Header, Footer, AdminSidebar
│   ├── features/                    # vertical slices (UI + actions + hooks per domain)
│   │   ├── catalogue/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── pricing/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── quotes/
│   │   ├── leads/
│   │   ├── purchase-orders/
│   │   └── dashboard/
│   ├── modules/                     # cross-cutting domain modules (auth, rbac, audit)
│   ├── hooks/                       # shared React hooks
│   ├── services/                    # business logic: PricingService, OrderService, PdfService,
│   │                                #   OtpProvider, PaymentProvider, EmailService, ExtractionService
│   ├── repositories/                # Prisma data-access (one per aggregate)
│   ├── lib/                         # prisma client, auth config, supabase, ratelimit, logger
│   ├── utils/                       # formatters (en-IN), slug, csv
│   ├── store/                       # Zustand stores (cart, ui/theme)
│   ├── types/
│   ├── validations/                 # Zod schemas
│   ├── emails/                      # React Email templates (order, quote, invoice, lead)
│   └── tests/                       # vitest unit/integration/component/api
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                      # 82 series, 130+ models, roles, demo users, projects, orders
├── public/
├── .github/workflows/ci.yml
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── eslint.config.mjs
├── .prettierrc
├── .husky/
├── vitest.config.ts
├── next.config.ts
└── package.json
```

## Layering rules
- **app → features → services → repositories → prisma.** UI never touches Prisma directly.
- **services** are framework-agnostic, pure where possible (PricingService is fully unit-tested).
- **repositories** are the only place importing `lib/prisma`.
- **Providers** (Otp/Payment/Extraction/Email) are injected via a small DI container in `lib/container.ts`, so mock⇄real swaps without touching callers.
- **validations** shared between RHF (client) and Server Actions (server).

# Supabase — schema & seed

These two files let you stand the database up directly in Supabase, fully dynamic (the app reads
everything from these tables — nothing is hardcoded at runtime). They are **generated from the same
source** as the Prisma workflow, so the data is identical to the HTML prototype.

| File | Contents |
|---|---|
| `schema.sql` | All 34 tables, enums-as-text, indexes, foreign keys. Byte-identical to `prisma/migrations/0_init/migration.sql`. |
| `seed.sql` | Full catalogue — **125 products, 466 variants**, finishes, 6 projects, 4 demo orders, 6 roles + 21 permissions, demo users, default pricing rule, settings. Idempotent (truncates then inserts). |

## Apply (Supabase SQL Editor)
1. Open your project → **SQL Editor** → New query.
2. Paste the contents of `schema.sql`, **Run**.
3. Paste the contents of `seed.sql`, **Run**.
4. Verify: `select count(*) from "Product";` → 125, `select count(*) from "ProductVariant";` → 466.

## Apply (psql / CI)
```bash
psql "$DIRECT_URL" -f supabase/schema.sql
psql "$DIRECT_URL" -f supabase/seed.sql
```

## Keep in sync
The seed is regenerated from `prisma/data/catalogue.ts` (the prototype extract):
```bash
npm run gen:seed-sql
```
If you change the Prisma schema, regenerate `schema.sql` too:
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > supabase/schema.sql
```

> The Prisma path (`npx prisma migrate deploy && npm run db:seed`) and this SQL path produce the
> same database. Use whichever fits your workflow; CI uses the Prisma path.

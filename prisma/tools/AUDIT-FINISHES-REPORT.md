# Finishes Reconciliation Audit — READ ONLY
Source of truth: `catalogue-products.xlsx` → sheet `Products`. Database: Supabase/Postgres via Prisma.

## PHASE 1 — Excel Analysis
- Sheet names: `Products` (audited: `Products`)
- Identifier column: `Code`  ·  Name column: `Name`  ·  Finish column: `Finishes` (comma-separated string)
- Total products in Excel: **125**
- Duplicate codes: **0**
- Duplicate names (normalized): **0**
- Rows with missing finishes: **0**
- Rows with invalid finish tokens: **0**

## PHASE 2 — Supabase / Database Analysis
- Products table: `Product`  ·  Primary key: `id` (cuid)  ·  Code field: `code` (`@unique`)  ·  Slug: `slug` (`@unique`)  ·  Name: `name`
- **SKU field: none** — no SKU column exists in the schema; matching falls back to slug/name.
- Finishes field: **relation** `finishes Product → ProductFinish(tier) → Finish(name)` (many-to-many). Not a scalar/array column.
- Total products in Database: **164**
- DB duplicate codes: **0** (`code` is `@unique`). Normalized-name collisions: **0**

<details><summary>SQL used for verification</summary>

```sql
-- total products
SELECT count(*) FROM "Product";
-- products with their finishes
SELECT p.code, p.slug, p.name,
             coalesce(array_agg(f.name) FILTER (WHERE f.name IS NOT NULL), '{}') AS finishes
      FROM "Product" p
      LEFT JOIN "ProductFinish" pf ON pf."productId" = p.id
      LEFT JOIN "Finish" f         ON f.id = pf."finishId"
      GROUP BY p.id, p.code, p.slug, p.name
      ORDER BY p.code;
-- duplicate codes
SELECT code, count(*) FROM "Product" GROUP BY code HAVING count(*) > 1;
```
</details>

## PHASE 3 — Matching Confidence
| Match method | Confidence | Count |
| --- | --- | --- |
| product_code | 100% | 124 |
| none | 0% | 1 |

Matches below 95% confidence are flagged for **manual review** (not auto-actioned).

## PHASE 4 — Audit Reports
### A. Products with Correct Finishes (Exact Match) — 124
| Product Name | Code | Excel Finishes | DB Finishes | Status |
| --- | --- | --- | --- | --- |
| ARON | ARON | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| IRIS | IRIS | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| KALIS | KALIS | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| KORIL | KORIL | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| LEDA | LEDA | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| SEMINA | SEMINA | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MIRA | MIRA | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| TORSA | TORSA | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| A | A_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| AH | AH_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| AK | AK_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| AMP | AMP | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| AS | AS_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| AUI | AU_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| U | U_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UB | UB | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UC | UC | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UE | UE_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UF | UF_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UFS | UFS | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UG | UG | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UH | UH | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UM | UM_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UO | UO | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UP | UP | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UQ | UQ | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UR | UR_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| US | US_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UT | UT_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| UZ | UZ_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork, Nordic White, Taupe Grey | ✅ Exact Match |
| K  | K_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| KKA | KKA | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| KOB KOS | KOB___KOS | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| KRK | KRK | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| KTL | KTL | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| KX | KX | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| KL | KL | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| O | O_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| OCT | OCT | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| OD | OD___ODB | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| OE | OE_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| OF | OF_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| OP | OP | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| OV | OV | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CL | CL_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CLB | CLB | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CLG | CLG | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CLK | CLK | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CLO | CLO | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CLT | CLT | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| B | B_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| BC | BC_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| BCH | BCH_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| BL | BL | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| BR | BR_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| BRF | BRF_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| BRL | BRL_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CC50 | CC | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CCL | CCL | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CK, CKB | CK_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CKL | CKL | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| COP | COP | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CS | CS_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CUBE-S | CUBE_S | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| DCL | DCL | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MF | MF_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MHR | MHR | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MK | MK | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| ML | ML | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MLS | MLS | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MR | MR_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MRA | MRA | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MRB | MRB | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MRR | MRR_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MU | MU | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| MUR | MUR | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| HK | HK_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| HKH | HKH | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| HM | HM | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| HV | HV_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| HVF | HVF | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| SB45 | SB | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| SJ | SJ | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| SO | SO | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| SR | SR_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| SRS | SRS_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| RR | RR_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| RRH | RRH_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
|  GR GRS | GR_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| GZL | GZL | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| SP | SP_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| DMB | DMB | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| DT | DT_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| EM | EM_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| EMBRACE BENCH | Embrace_Bench | Natural Clay, White, Anthracite, Leather Option | Natural Clay, White, Anthracite, Leather Option | ✅ Exact Match |
| KH | KH_Seating | Natural Clay, White, Anthracite, Leather Option | Natural Clay, White, Anthracite, Leather Option | ✅ Exact Match |
| MLH | MLH | Natural Clay, White, Anthracite, Leather Option | Natural Clay, White, Anthracite, Leather Option | ✅ Exact Match |
| DC | DC_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| FGSFGR | FGS___FGR | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| IP | IP | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| LC | LC | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| LK | LK | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| LMP | LMP | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| LP | LPS | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| LR | LR | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| LRC | LRC | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| ADAMAS | ADAMAS | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| ANTHOS | ANTHOS | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CB | CB | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CBH | CBH_Series | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| CLE | CLE | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| PB | PB | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| PL | PL___PLU | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| PT | PT | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| RB / RBC | RB___RBC | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| SY / SYD | SY___SYD | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| TA | TA | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| TAALO | TAALO | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| TAH | TAH | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| TAJ50 | TAJ | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| TW | TW | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| ZB | ZB | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| ZS | ZS | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |
| ZSL | ZSL | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | Natural Clay, White, Ivory, Terracotta Red, Bordeaux Red, Deep Blue, Anthracite, Cork | ✅ Exact Match |

### B. Missing Finishes in Database — 0
| Product Name | Code | Excel Finishes | DB Finishes | Action |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

### C. Missing Finishes in Excel — 0
| Product Name | Code | DB Finishes | Excel Finishes | Action |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

### D. Finish Mismatches — 0
| Product Name | Code | Excel (truth) | DB (current) | Missing in DB | Extra in DB | Recommended |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | — |

### E. In Excel but Not in Database — 1
| Product Name | Code (Excel) | Note |
| --- | --- | --- |
| SRD | SRD | No code/slug/name match in DB |

### F. In Database but Not in Excel — 40
| Product Name | Code | DB Finishes |
| --- | --- | --- |
| AB | AB_56650 | White, Grey, Black, Red, Bordeaux, Clay |
| AH130 | AH130_01162 | ∅ (empty) |
| AHB | AHB_05074 | ∅ (empty) |
| AHC | AHC_37899 | ∅ (empty) |
| AHE | AHE_51725 | ∅ (empty) |
| AHO | AHO_82250 | ∅ (empty) |
| AHP | AHP_73015 | Red |
| AHS | AHS_14663 | ∅ (empty) |
| AHSB | AHSB_99315 | ∅ (empty) |
| AHT | AHT_33304 | ∅ (empty) |
| ASL | ASL_63191 | Bronze |
| CSD  | ATELIER_VIERKANT___COLLECTION_2022_228_CSD_CSD15C_W_CSD15W_C_CSD15W_89216 | ∅ (empty) |
| ALPH-BENCH | ATELIER_VIERKANT___COLLECTION_2022_WWW_ATELIERVIERKANT_COM_78_79_38082 | Clay |
| AU | AU_16747 | ∅ (empty) |
| AUB | AUB_65520 | Grey, Ivory |
| AUB180 | AUB180_58508 | ∅ (empty) |
| AUO | AUO_68493 | ∅ (empty) |
| AUS100 | AUS100_60567 | White, Grey, Red |
| AUS180 | AUS180_58937 | ∅ (empty) |
| B CUBE | B_CUBE_57845 | Grey, Black |
| BE4545 | BE4545_12492 | White, Anthracite, Black, Brown, Gold |
| CBH180 | CBH180_17881 | ∅ (empty) |
| CVI | CVI_55823 | ∅ (empty) |
| EMBRACE SEAT | EMBRACE_SEAT_60550 | Clay |
| FGS SEAT | FGS_SEAT_64568 | ∅ (empty) |
| JANUA JANUS | JANUA_JANUS_01074 | ∅ (empty) |
| KH Leather | KH_LEATHER_13748 | Rust, Clay |
| KHL | KHL_19273 | ∅ (empty) |
| KHO | KHO_08851 | ∅ (empty) |
| KR120 | KR120_15305 | ∅ (empty) |
| LPS100 | LPS100_53061 | White, Grey, Black, Red, Green, Clay |
| MLH BENCH | MLH_BENCH_32357 | ∅ (empty) |
| RVB | RVB_26638 | Clay |
| RVC | RVC_43399 | ∅ (empty) |
| SB 15 | SB_90615 | ∅ (empty) |
| SB30 | SB30_64661 | ∅ (empty) |
| TAJ100 | TAJ100_44130 | ∅ (empty) |
| TAJ150 | TAJ150_40621 | ∅ (empty) |
| TORSA 70 | TORSA_70_55183 | ∅ (empty) |
| WT | WT_70875 | ∅ (empty) |

### G. Duplicates
- Excel duplicate codes: none
- Excel duplicate names: none
- Database duplicate codes: none (`@unique`)
- Database duplicate names: none

### ⚠ Flagged for Manual Review (confidence < 95%) — 0
| Excel Name | Excel Code | Method | Confidence |
| --- | --- | --- | --- |
| — | — | — | — |

## PHASE 5 — Summary Dashboard
| Metric | Value |
| --- | --- |
| Total products in Excel | 125 |
| Total products in Database | 164 |
| Total matched products | 124 |
| Exact finish matches (A) | 124 |
| Missing finishes in DB (B) | 0 |
| Missing finishes in Excel (C) | 0 |
| Finish mismatches (D) | 0 |
| Excel-only products (E) | 1 |
| Database-only products (F) | 40 |
| Duplicate products (Excel codes+names) | 0 |
| Flagged for manual review | 0 |

## PHASE 6 — Update Preview (NO changes applied)
These are the products that *would* be updated, with old → new finishes. Mismatches (D) and DB-missing (B) only; correct (A) and DB-only (F) are left untouched.

| Code | Product | Old (DB) Finishes | New (Excel) Finishes | Records affected (ProductFinish rows) |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

- Products that would be updated: **0**
- ProductFinish rows that would be written: **0**
- Confidence on all previewed updates: ≥95% (lower-confidence rows excluded above).

> Audit only — no database changes were made. Use `update-finishes.ts --apply` to act on these after review.
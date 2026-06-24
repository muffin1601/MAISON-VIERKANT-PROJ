/** READ ONLY — lists products & variants with no price (eurPrice null or 0). */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { code: true, name: true, eurPrice: true },
    orderBy: { code: "asc" },
  });
  const variants = await prisma.productVariant.findMany({
    select: { code: true, eurPrice: true, product: { select: { code: true, name: true } } },
    orderBy: { code: "asc" },
  });

  const noProdPrice = products.filter((p) => p.eurPrice == null || Number(p.eurPrice) === 0);
  const noVarPrice = variants.filter((v) => v.eurPrice == null || Number(v.eurPrice) === 0);

  console.log(`=== PRODUCTS without price (${noProdPrice.length} / ${products.length}) ===`);
  for (const p of noProdPrice) console.log(`${p.code}\t${p.name}\t€${p.eurPrice}`);

  console.log(`\n=== VARIANTS (model codes) without price (${noVarPrice.length} / ${variants.length}) ===`);
  for (const v of noVarPrice) console.log(`${v.code}\t(${v.product.name})\t€${v.eurPrice}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

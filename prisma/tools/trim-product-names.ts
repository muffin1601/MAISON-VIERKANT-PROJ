/** Trims leading/trailing whitespace in Product.name (and collapses internal runs).
 *  Touches ONLY name, and only rows where it actually differs. */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, code: true, name: true } });
  const dirty = products
    .map((p) => ({ ...p, clean: p.name.replace(/\s+/g, " ").trim() }))
    .filter((p) => p.clean !== p.name);

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${dirty.length} product name(s) need trimming:\n`);
  for (const p of dirty) console.log(`  ${p.code}: "${p.name}" → "${p.clean}"`);

  if (APPLY) {
    for (const p of dirty) {
      await prisma.product.update({ where: { id: p.id }, data: { name: p.clean } });
    }
    console.log(`\n✅ Updated ${dirty.length} product name(s).`);
  } else if (dirty.length) {
    console.log(`\nRe-run with --apply to commit.`);
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

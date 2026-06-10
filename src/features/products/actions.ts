"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { productSchema, type ProductInput } from "@/validations/product";
import { slugify } from "@/lib/format";

async function categoryId(series: string): Promise<string> {
  const existing = await prisma.category.findUnique({ where: { key: series } });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { key: series, name: series } });
  return created.id;
}

async function finishIds(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const f =
      (await prisma.finish.findUnique({ where: { name } })) ??
      (await prisma.finish.create({ data: { name } }));
    ids.push(f.id);
  }
  return ids;
}

async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || "series";
  let s = base;
  let i = 2;
  while (true) {
    const hit = await prisma.product.findUnique({ where: { slug: s } });
    if (!hit || hit.id === excludeId) return s;
    s = `${base}-${i++}`;
  }
}

export async function saveProduct(input: ProductInput): Promise<{ id: string }> {
  await requirePermission("products.write");
  const d = productSchema.parse(input);
  const catId = await categoryId(d.series);
  const fins = await finishIds(d.finishes);

  const images = [
    ...(d.heroImg ? [{ url: d.heroImg, type: "HERO", sort: 0 }] : []),
    ...d.gallery.map((url, i) => ({ url, type: "GALLERY", sort: i + 1 })),
  ];

  if (d.id) {
    // Update: replace children for simplicity (small per-product sets).
    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { productId: d.id } }),
      prisma.productFinish.deleteMany({ where: { productId: d.id } }),
      prisma.productVariant.deleteMany({ where: { productId: d.id } }),
      prisma.product.update({
        where: { id: d.id },
        data: {
          name: d.name,
          description: d.description,
          eurPrice: d.eurPrice,
          categoryId: catId,
          slug: await uniqueSlug(d.name, d.id),
          images: { create: images },
          finishes: { create: fins.map((fid) => ({ finishId: fid, tier: "STD" })) },
          variants: { create: d.models.map((m) => ({ code: m.code, eurPrice: m.eur, dims: m.dims })) },
        },
      }),
    ]);
    revalidatePath("/admin/products");
    revalidatePath("/collection");
    return { id: d.id };
  }

  const code = d.name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const product = await prisma.product.create({
    data: {
      code: `${code}_${Date.now().toString().slice(-5)}`,
      slug: await uniqueSlug(d.name),
      name: d.name,
      description: d.description,
      eurPrice: d.eurPrice,
      categoryId: catId,
      images: { create: images },
      finishes: { create: fins.map((fid) => ({ finishId: fid, tier: "STD" })) },
      variants: { create: d.models.map((m) => ({ code: m.code, eurPrice: m.eur, dims: m.dims })) },
      inventory: { create: { quantity: d.stock, lowStockThreshold: 2 } },
    },
  });
  revalidatePath("/admin/products");
  revalidatePath("/collection");
  return { id: product.id };
}

export async function deleteProduct(id: string): Promise<{ ok: boolean }> {
  await requirePermission("products.write");
  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/collection");
  return { ok: true };
}

import "server-only";
import { prisma } from "@/lib/prisma";

/** Server-backed wishlist scoped to a storefront user's CRM Customer record. */

async function getOrCreateCustomerId(userId: string): Promise<string> {
  const existing = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");
  const created = await prisma.customer.create({
    data: { userId, name: user.name ?? user.email ?? "Customer", email: user.email },
    select: { id: true },
  });
  return created.id;
}

export async function listWishlist(userId: string): Promise<string[]> {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) return [];
  const rows = await prisma.wishlistItem.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    select: { productSlug: true },
  });
  return rows.map((r) => r.productSlug);
}

export async function addToWishlist(userId: string, slug: string): Promise<void> {
  const customerId = await getOrCreateCustomerId(userId);
  await prisma.wishlistItem.upsert({
    where: { customerId_productSlug: { customerId, productSlug: slug } },
    create: { customerId, productSlug: slug },
    update: {},
  });
}

export async function removeFromWishlist(userId: string, slug: string): Promise<void> {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) return;
  await prisma.wishlistItem
    .delete({ where: { customerId_productSlug: { customerId: customer.id, productSlug: slug } } })
    .catch(() => {});
}

/** Merge client (local) slugs into the server set; returns the unified list. */
export async function syncWishlist(userId: string, localSlugs: string[]): Promise<string[]> {
  const customerId = await getOrCreateCustomerId(userId);
  const clean = Array.from(new Set(localSlugs.filter((s) => typeof s === "string" && s.length > 0))).slice(0, 500);
  if (clean.length > 0) {
    await prisma.wishlistItem.createMany({
      data: clean.map((productSlug) => ({ customerId, productSlug })),
      skipDuplicates: true,
    });
  }
  const rows = await prisma.wishlistItem.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: { productSlug: true },
  });
  return rows.map((r) => r.productSlug);
}

import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Coupon validation + discount math. The discount is always computed server-side
 * against the SERVER total — the client never supplies an amount. Returns a
 * discriminated result so callers can surface a precise reason.
 */

export interface CouponOk {
  ok: true;
  code: string;
  discountInr: number;
  label: string;
  couponId: string;
}
export interface CouponErr {
  ok: false;
  reason: string;
}
export type CouponResult = CouponOk | CouponErr;

function computeDiscount(
  coupon: { type: string; value: unknown; maxDiscountInr: unknown },
  baseInr: number,
): number {
  const value = Number(coupon.value);
  let d = coupon.type === "FLAT" ? value : (baseInr * value) / 100;
  const cap = coupon.maxDiscountInr != null ? Number(coupon.maxDiscountInr) : null;
  if (cap != null && d > cap) d = cap;
  if (d > baseInr) d = baseInr; // never exceed the order
  return Math.max(0, Math.round(d));
}

/**
 * Validate a coupon for a given pre-discount total and (optional) customer.
 * `baseInr` is the amount the discount applies to (we use the full order total).
 */
export async function validateCoupon(
  rawCode: string,
  baseInr: number,
  customerId?: string | null,
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: "Enter a coupon code." };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive) return { ok: false, reason: "This coupon is not valid." };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, reason: "This coupon isn't active yet." };
  if (coupon.expiresAt && coupon.expiresAt < now) return { ok: false, reason: "This coupon has expired." };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }
  if (Number(coupon.minSubtotalInr) > baseInr) {
    return { ok: false, reason: `Spend at least ₹${Number(coupon.minSubtotalInr).toLocaleString("en-IN")} to use this coupon.` };
  }
  if (customerId && coupon.perUserLimit > 0) {
    const used = await prisma.couponRedemption.count({ where: { couponId: coupon.id, customerId } });
    if (used >= coupon.perUserLimit) return { ok: false, reason: "You've already used this coupon." };
  }

  const discountInr = computeDiscount(coupon, baseInr);
  if (discountInr <= 0) return { ok: false, reason: "This coupon gives no discount on your cart." };

  const label =
    coupon.type === "FLAT"
      ? `₹${Number(coupon.value).toLocaleString("en-IN")} off`
      : `${Number(coupon.value)}% off`;
  return { ok: true, code, discountInr, label, couponId: coupon.id };
}

/** Record a redemption and bump usedCount. Best-effort; called at order finalize. */
export async function recordRedemption(params: {
  code: string;
  amountInr: number;
  customerId?: string | null;
  orderNumber?: string | null;
}): Promise<void> {
  const code = params.code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
  if (!coupon) return;
  await prisma.$transaction([
    prisma.couponRedemption.create({
      data: {
        couponId: coupon.id,
        customerId: params.customerId ?? null,
        orderNumber: params.orderNumber ?? null,
        amountInr: params.amountInr,
      },
    }),
    prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } }),
  ]);
}

export interface CouponView {
  code: string;
  description: string;
  label: string;
  minSubtotalInr: number;
  expiresAt: string | null;
}

/** Public, currently-usable coupons for the "available coupons" list. */
export async function listAvailableCoupons(): Promise<CouponView[]> {
  const now = new Date();
  const rows = await prisma.coupon.findMany({
    where: {
      isActive: true,
      isPublic: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows
    .filter((c) => c.usageLimit == null || c.usedCount < c.usageLimit)
    .map((c) => ({
      code: c.code,
      description: c.description ?? "",
      label: c.type === "FLAT" ? `₹${Number(c.value).toLocaleString("en-IN")} off` : `${Number(c.value)}% off`,
      minSubtotalInr: Number(c.minSubtotalInr),
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    }));
}

/** A customer's past coupon usage. */
export async function listUsedCoupons(customerId: string) {
  const rows = await prisma.couponRedemption.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { coupon: { select: { code: true, description: true } } },
    take: 50,
  });
  return rows.map((r) => ({
    code: r.coupon.code,
    description: r.coupon.description ?? "",
    amountInr: Number(r.amountInr),
    orderNumber: r.orderNumber,
    usedAt: r.createdAt.toISOString(),
  }));
}

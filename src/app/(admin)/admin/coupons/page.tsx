import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { CouponAdmin, type CouponRow } from "@/features/admin/CouponAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "pricing.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Coupons</div>
        <div className="a-sub">You do not have access to coupons.</div>
      </div>
    );
  }

  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  const rows: CouponRow[] = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    value: Number(c.value),
    minSubtotalInr: Number(c.minSubtotalInr),
    maxDiscountInr: c.maxDiscountInr != null ? Number(c.maxDiscountInr) : null,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    isActive: c.isActive,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
  }));

  return (
    <div className="a-page active">
      <div className="a-title">Coupons</div>
      <div className="a-sub">Create and manage discount codes</div>
      <CouponAdmin initial={rows} />
    </div>
  );
}

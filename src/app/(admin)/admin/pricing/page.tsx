import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getProducts, getActivePricing } from "@/services/catalogue/catalogue";
import { PricingEngine } from "@/features/pricing/PricingEngine";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "pricing.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Pricing Engine</div>
        <div className="a-sub">You do not have access to pricing.</div>
      </div>
    );
  }

  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);
  return (
    <PricingEngine
      products={products}
      initial={pricing}
      canManage={hasPermission(user.permissions, "pricing.manage")}
    />
  );
}

import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getProducts } from "@/services/catalogue/catalogue";
import { PurchaseOrderBuilder, type VariantOpt } from "@/features/purchase/PurchaseOrderBuilder";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "purchase.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Purchase Order</div>
        <div className="a-sub">You do not have access to purchase orders.</div>
      </div>
    );
  }

  const products = await getProducts();
  const variants: VariantOpt[] = products.flatMap((p) =>
    p.models.map((m) => ({ code: m.code, eur: m.eur, series: p.series })),
  );

  return <PurchaseOrderBuilder variants={variants} />;
}

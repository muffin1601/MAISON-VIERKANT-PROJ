import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getProducts, getActivePricing } from "@/services/catalogue/catalogue";
import { ProductsView } from "@/features/products/ProductsView";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "products.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Products Manager</div>
        <div className="a-sub">You do not have access to products.</div>
      </div>
    );
  }

  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);
  const categories = [...new Set(products.map((p) => p.series))].sort();

  return (
    <div className="a-page active">
      <div className="a-title">Products Manager</div>
      <div className="a-sub">
        Add, edit or remove any product. All changes update the website instantly including INR
        pricing.
      </div>
      <ProductsView products={products} pricing={pricing} categories={categories} />
    </div>
  );
}

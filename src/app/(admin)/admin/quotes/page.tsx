import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getProducts, getActivePricing } from "@/services/catalogue/catalogue";
import { QuoteBuilder } from "@/features/quotes/QuoteBuilder";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "quotes.write")) {
    return (
      <div className="a-page active">
        <div className="a-title">Create Quote</div>
        <div className="a-sub">You do not have access to quotes.</div>
      </div>
    );
  }
  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);
  return <QuoteBuilder products={products} pricing={pricing} />;
}

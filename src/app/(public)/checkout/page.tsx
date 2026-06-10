import { getProducts, getActivePricing } from "@/services/catalogue/catalogue";
import { calcINR } from "@/services/pricing/PricingService";
import type { PriceMap } from "@/features/cart/CartView";
import { CheckoutView } from "@/features/checkout/CheckoutView";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);
  const priceMap: PriceMap = {};
  for (const p of products) {
    const info = { series: p.series, img: p.imgs[0] ?? "" };
    for (const m of p.models) {
      priceMap[`${p.code}|${m.code}`] = {
        unit: m.eur > 0 ? calcINR(m.eur, pricing) : 0,
        dims: m.dims,
        ...info,
      };
    }
    priceMap[`${p.code}|${p.name}`] = { unit: calcINR(p.eurPrice, pricing), dims: p.dims, ...info };
  }
  return <CheckoutView priceMap={priceMap} />;
}

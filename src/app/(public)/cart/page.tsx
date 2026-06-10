import { getProducts, getActivePricing } from "@/services/catalogue/catalogue";
import { calcINR } from "@/services/pricing/PricingService";
import { CartView, type PriceMap } from "@/features/cart/CartView";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);

  const priceMap: PriceMap = {};
  for (const p of products) {
    const info = { series: p.series, img: p.imgs[0] ?? "" };
    if (p.models.length) {
      for (const m of p.models) {
        priceMap[`${p.code}|${m.code}`] = {
          unit: m.eur > 0 ? calcINR(m.eur, pricing) : 0,
          dims: m.dims,
          ...info,
        };
      }
    }
    // no-model line key (prototype uses product name as code)
    priceMap[`${p.code}|${p.name}`] = {
      unit: calcINR(p.eurPrice, pricing),
      dims: p.dims,
      ...info,
    };
  }

  return (
    <div id="page-cart" className="page active">
      <CartView priceMap={priceMap} />
    </div>
  );
}

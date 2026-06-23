"use client";

import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/store/cart";
import { showToast } from "@/lib/toast";

/** Re-adds every line from a past order to the cart, then routes to /cart. */
export function ReorderButton({ lines }: { lines: { item: Omit<CartItem, "qty">; qty: number }[] }) {
  const add = useCart((s) => s.add);
  const router = useRouter();

  function reorder() {
    if (lines.length === 0) {
      showToast("Nothing to reorder.");
      return;
    }
    lines.forEach(({ item, qty }) => add(item, qty));
    showToast("Items added to your cart.");
    router.push("/cart");
  }

  return (
    <button type="button" className="btn-dark" onClick={reorder}>
      Reorder
    </button>
  );
}

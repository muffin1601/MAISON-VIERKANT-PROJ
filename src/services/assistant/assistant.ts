import "server-only";
import { prisma } from "@/lib/prisma";
import { statusLabel, retailTimeline } from "@/lib/orderStatus";
import { listAvailableCoupons } from "@/services/coupons/coupons";

/**
 * Deterministic e-commerce assistant. Intent is matched by keyword/regex and
 * answered from real data (orders, coupons, products) plus canned policy text.
 * No LLM — predictable, zero-cost, privacy-safe (order lookup is owner-scoped).
 */

export interface AssistantReply {
  reply: string;
  suggestions?: string[];
  links?: { label: string; href: string }[];
}

const SUGGESTIONS = ["Track my order", "Shipping info", "Return policy", "Available coupons", "Recommend a piece"];

export async function answer(message: string, userId: string | null): Promise<AssistantReply> {
  const text = message.trim().toLowerCase();
  if (!text) return { reply: "How can I help you today?", suggestions: SUGGESTIONS };

  // --- Order status lookup (owner-scoped) ---
  const orderMatch = message.match(/MVI-ORD-[A-Z0-9]+/i);
  if (orderMatch || /\b(track|order status|where.*order|my order)\b/.test(text)) {
    return orderStatusReply(orderMatch?.[0] ?? null, userId);
  }

  // --- Coupons ---
  if (/\b(coupon|promo|discount|offer|code)\b/.test(text)) {
    const coupons = await listAvailableCoupons();
    if (coupons.length === 0)
      return { reply: "There are no public coupons right now, but keep an eye on your account — we add them often.", suggestions: SUGGESTIONS };
    const lines = coupons.slice(0, 5).map((c) => `• ${c.code} — ${c.label}${c.minSubtotalInr ? ` (min ₹${c.minSubtotalInr.toLocaleString("en-IN")})` : ""}`);
    return {
      reply: `Here are the coupons you can use:\n${lines.join("\n")}\nApply one at checkout in the coupon box.`,
      links: [{ label: "View coupons", href: "/account/coupons" }],
      suggestions: SUGGESTIONS,
    };
  }

  // --- Shipping ---
  if (/\b(ship|delivery|deliver|dispatch|how long|when.*arrive|lead time)\b/.test(text)) {
    return {
      reply:
        "Each piece is handcrafted in Ostend, Belgium, so production takes 10–14 weeks. Delivery within Delhi is included; transport elsewhere in India is charged at actual. You'll get tracking once your order is dispatched.",
      links: [{ label: "Shipping details", href: "/shipping" }],
      suggestions: SUGGESTIONS,
    };
  }

  // --- Returns / refunds ---
  if (/\b(return|refund|cancel|exchange|damaged|broken)\b/.test(text)) {
    return {
      reply:
        "Cancellations are free within 48 hours of the advance payment. Transit damage? Report it within 48 hours with photos and we'll repair or replace at no cost. Refunds reach your original payment method in 7–10 business days.",
      links: [
        { label: "Returns policy", href: "/returns" },
        { label: "Raise a request", href: "/account/support?type=RETURN" },
      ],
      suggestions: SUGGESTIONS,
    };
  }

  // --- Payment ---
  if (/\b(pay|payment|razorpay|card|upi|cod|cash on delivery|bank transfer)\b/.test(text)) {
    return {
      reply:
        "You can pay the 50% advance online via Razorpay (UPI, cards, net-banking, wallets) or by bank transfer / UPI with proof upload. The balance is due before dispatch.",
      suggestions: SUGGESTIONS,
    };
  }

  // --- Product recommendation ---
  if (/\b(recommend|suggest|looking for|show me|planter|pot|vase|series|piece|best seller|popular)\b/.test(text)) {
    return productReply(text);
  }

  // --- Greeting / fallback ---
  if (/\b(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(text)) {
    return { reply: "Hello! I'm the Maison Vierkant assistant. I can track orders, explain shipping & returns, share coupons, or recommend a piece. What would you like?", suggestions: SUGGESTIONS };
  }

  return {
    reply:
      "I can help with order tracking, shipping, returns & refunds, coupons, payments, and product recommendations. For anything else, our team is on WhatsApp or at hello@maisonvierkant.in.",
    links: [{ label: "Contact support", href: "/account/support" }],
    suggestions: SUGGESTIONS,
  };
}

async function orderStatusReply(number: string | null, userId: string | null): Promise<AssistantReply> {
  if (!userId) {
    return {
      reply: "Please sign in to track your order — I can then show its live status and timeline.",
      links: [{ label: "Sign in", href: "/account/login" }],
      suggestions: SUGGESTIONS,
    };
  }
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) return { reply: "I couldn't find any orders on your account yet.", links: [{ label: "Browse collection", href: "/collection" }] };

  if (number) {
    const order = await prisma.order.findFirst({
      where: { number: number.toUpperCase(), customerId: customer.id },
      select: { number: true, status: true },
    });
    if (!order) return { reply: `I couldn't find order ${number.toUpperCase()} on your account.`, links: [{ label: "My orders", href: "/account/orders" }] };
    const tl = retailTimeline(order.status);
    const stage = tl.terminal ? tl.terminal.label : tl.stages.find((s) => s.current)?.label ?? statusLabel(order.status);
    return {
      reply: `Order ${order.number} is currently: ${stage}.`,
      links: [{ label: "View order", href: `/account/orders/${order.number}` }],
      suggestions: SUGGESTIONS,
    };
  }

  const recent = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { number: true, status: true },
  });
  if (recent.length === 0) return { reply: "You don't have any orders yet.", links: [{ label: "Browse collection", href: "/collection" }] };
  const lines = recent.map((o) => `• ${o.number} — ${statusLabel(o.status)}`);
  return {
    reply: `Your recent orders:\n${lines.join("\n")}`,
    links: [{ label: "All orders", href: "/account/orders" }],
    suggestions: SUGGESTIONS,
  };
}

async function productReply(text: string): Promise<AssistantReply> {
  // Pull a few active products, preferring featured; light keyword filter on name.
  const kw = text.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 3);
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    take: 30,
    select: { name: true, slug: true },
  });
  const picks = (kw.length ? products.filter((p) => kw.some((w) => p.name.toLowerCase().includes(w))) : products).slice(0, 4);
  const chosen = picks.length ? picks : products.slice(0, 4);
  if (chosen.length === 0) return { reply: "Browse our full collection to find your piece.", links: [{ label: "View collection", href: "/collection" }] };
  return {
    reply: `Here are a few pieces you might like:\n${chosen.map((p) => `• ${p.name}`).join("\n")}`,
    links: chosen.map((p) => ({ label: p.name, href: `/products/${p.slug}` })),
    suggestions: SUGGESTIONS,
  };
}

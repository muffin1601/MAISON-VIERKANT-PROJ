import "server-only";
import { prisma } from "@/lib/prisma";
import { statusLabel, retailTimeline } from "@/lib/orderStatus";
import { listAvailableCoupons } from "@/services/coupons/coupons";
import { getProducts, getActivePricing, cardPrice } from "@/services/catalogue/catalogue";

/**
 * Production rule-based e-commerce assistant. NO AI provider, NO external API,
 * ZERO cost. Pure keyword matching + real database lookups — it never invents an
 * answer (product cards come straight from the catalogue; order status is the
 * owner's real order). Deterministic and fast.
 */

export type Intent =
  | "PRODUCT_SEARCH"
  | "ORDER_TRACKING"
  | "SHIPPING_INFO"
  | "RETURN_POLICY"
  | "REFUND_POLICY"
  | "COUPON_INFO"
  | "CONTACT_SUPPORT"
  | "CATEGORY_BROWSE"
  | "WISHLIST_HELP"
  | "CART_HELP"
  | "GREETING"
  | "FALLBACK";

export interface ProductCard {
  name: string;
  price: string; // formatted, e.g. "From ₹2,65,118"
  image: string;
  href: string;
}

export interface AssistantReply {
  intent: Intent;
  reply: string;
  products?: ProductCard[];
  links?: { label: string; href: string }[];
  suggestions: string[];
}

const DEFAULT_CHIPS = ["Track Order", "Shipping", "Returns", "Coupons", "Contact Support"];
const FALLBACK_CHIPS = ["Track Order", "Browse Products", "Contact Support"];

/**
 * Intent keyword table, evaluated in PRIORITY ORDER (first list with any hit wins).
 * Matching is plain lowercase substring — so "coupons", "shipping", "returns" all
 * hit, fixing the word-boundary misses. PRODUCT_SEARCH is handled separately, after
 * these, so e.g. "show me coupons" resolves to COUPON_INFO, not products.
 */
const INTENT_KEYWORDS: { intent: Exclude<Intent, "PRODUCT_SEARCH" | "GREETING" | "FALLBACK">; keywords: string[] }[] = [
  { intent: "ORDER_TRACKING", keywords: ["track", "order status", "where is my order", "where's my order", "my order", "order id", "order number", "mvi-ord"] },
  { intent: "RETURN_POLICY", keywords: ["return", "exchange", "replacement", "replace", "damaged", "broken", "wrong item"] },
  { intent: "REFUND_POLICY", keywords: ["refund", "money back", "moneyback", "chargeback"] },
  { intent: "COUPON_INFO", keywords: ["coupon", "discount", "promo", "offer", "voucher", "promo code", "code"] },
  { intent: "SHIPPING_INFO", keywords: ["ship", "shipping", "delivery", "deliver", "dispatch", "how long", "lead time", "when will", "arrive", "courier", "tracking number"] },
  { intent: "WISHLIST_HELP", keywords: ["wishlist", "wish list", "saved item", "favourite", "favorite", "save for later"] },
  { intent: "CART_HELP", keywords: ["cart", "basket", "add to cart", "remove from cart", "my bag"] },
  { intent: "CONTACT_SUPPORT", keywords: ["support", "contact", "help", "talk to", "human", "agent", "customer care", "phone", "email", "whatsapp", "complaint"] },
  { intent: "CATEGORY_BROWSE", keywords: ["browse", "categories", "category", "collection", "all products", "what do you sell", "series list", "catalogue", "catalog"] },
];

const PRODUCT_TRIGGERS = ["show", "find", "search", "looking for", "do you have", "recommend", "suggest", "need a", "want a", "buy", "price of", "products"];

export async function answer(message: string, userId: string | null): Promise<AssistantReply> {
  const text = message.trim().toLowerCase();
  if (!text) return { intent: "FALLBACK", reply: "How can I help you today?", suggestions: DEFAULT_CHIPS };

  if (/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(text)) {
    return {
      intent: "GREETING",
      reply:
        "Hello! I'm the Maison Vierkant assistant. I can track orders, find products, explain shipping/returns/refunds, and share coupons. What do you need?",
      suggestions: DEFAULT_CHIPS,
    };
  }

  // 1) Priority intent table (substring match).
  for (const { intent, keywords } of INTENT_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) {
      return dispatch(intent, message, userId);
    }
  }

  // 2) Explicit product search ("show pool filters", "find a planter", "buy vase").
  if (PRODUCT_TRIGGERS.some((k) => text.includes(k))) {
    return productSearch(text);
  }

  // 3) Last resort: maybe the raw text IS a product/series name — search the DB.
  const found = await productSearch(text);
  if (found.products && found.products.length > 0) return found;

  // 4) Nothing recognised.
  return {
    intent: "FALLBACK",
    reply:
      "I'm not sure about that one. I can help you track an order, browse products, or reach our support team. You can also message us on WhatsApp or at hello@maisonvierkant.in.",
    links: [{ label: "Browse the collection", href: "/collection" }],
    suggestions: FALLBACK_CHIPS,
  };
}

async function dispatch(intent: Intent, message: string, userId: string | null): Promise<AssistantReply> {
  switch (intent) {
    case "ORDER_TRACKING":
      return orderTracking(message, userId);
    case "SHIPPING_INFO":
      return {
        intent,
        reply:
          "Every piece is handcrafted in Ostend, Belgium, so production takes 10–14 weeks. Delivery within Delhi is included; transport elsewhere in India is charged at actual. You'll receive a courier and tracking number once your order is dispatched.",
        links: [{ label: "Shipping details", href: "/shipping" }],
        suggestions: DEFAULT_CHIPS,
      };
    case "RETURN_POLICY":
      return {
        intent,
        reply:
          "Cancellations are free within 48 hours of the advance payment. If a piece arrives damaged, report it within 48 hours with photos and we'll repair or replace it at no cost.",
        links: [
          { label: "Returns policy", href: "/returns" },
          { label: "Raise a return request", href: "/account/support?type=RETURN" },
        ],
        suggestions: DEFAULT_CHIPS,
      };
    case "REFUND_POLICY":
      return {
        intent,
        reply:
          "Approved refunds are issued to your original payment method within 7–10 business days. For order-specific refunds, raise a request and our team will process it.",
        links: [{ label: "Request a refund", href: "/account/support?type=REFUND" }],
        suggestions: DEFAULT_CHIPS,
      };
    case "COUPON_INFO":
      return couponInfo();
    case "CONTACT_SUPPORT":
      return {
        intent,
        reply:
          "Our team is happy to help. Email hello@maisonvierkant.in, call +91 7669469620, or tap WhatsApp (bottom-right). You can also raise a ticket and we'll reply within 24 hours.",
        links: [
          { label: "Contact us", href: "/contact" },
          { label: "Raise a support ticket", href: "/account/support" },
        ],
        suggestions: DEFAULT_CHIPS,
      };
    case "WISHLIST_HELP":
      return {
        intent,
        reply:
          "Tap the heart on any product to save it to your wishlist. When signed in, your wishlist syncs across all your devices and is waiting at My Account → Wishlist.",
        links: [{ label: "Open wishlist", href: "/wishlist" }],
        suggestions: DEFAULT_CHIPS,
      };
    case "CART_HELP":
      return {
        intent,
        reply:
          "Add pieces to your cart from any product page, then open the cart to review quantities and check out. Your cart is saved on this device until you're ready.",
        links: [{ label: "View cart", href: "/cart" }],
        suggestions: DEFAULT_CHIPS,
      };
    case "CATEGORY_BROWSE":
      return categoryBrowse();
    default:
      return { intent: "FALLBACK", reply: "How can I help?", suggestions: DEFAULT_CHIPS };
  }
}

async function orderTracking(message: string, userId: string | null): Promise<AssistantReply> {
  if (!userId) {
    return {
      intent: "ORDER_TRACKING",
      reply: "Please sign in to track your order — I can then show its live status and timeline.",
      links: [{ label: "Sign in", href: "/account/login" }],
      suggestions: DEFAULT_CHIPS,
    };
  }
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) {
    return { intent: "ORDER_TRACKING", reply: "You don't have any orders yet.", links: [{ label: "Browse collection", href: "/collection" }], suggestions: DEFAULT_CHIPS };
  }
  const num = message.match(/MVI-ORD-[A-Z0-9]+/i)?.[0];
  if (num) {
    const order = await prisma.order.findFirst({ where: { number: num.toUpperCase(), customerId: customer.id }, select: { number: true, status: true } });
    if (!order) return { intent: "ORDER_TRACKING", reply: `I couldn't find order ${num.toUpperCase()} on your account.`, links: [{ label: "My orders", href: "/account/orders" }], suggestions: DEFAULT_CHIPS };
    const tl = retailTimeline(order.status);
    const stage = tl.terminal ? tl.terminal.label : tl.stages.find((s) => s.current)?.label ?? statusLabel(order.status);
    return { intent: "ORDER_TRACKING", reply: `Order ${order.number} is currently: ${stage}.`, links: [{ label: "View order", href: `/account/orders/${order.number}` }], suggestions: DEFAULT_CHIPS };
  }
  const recent = await prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 3, select: { number: true, status: true } });
  if (recent.length === 0) return { intent: "ORDER_TRACKING", reply: "You don't have any orders yet.", links: [{ label: "Browse collection", href: "/collection" }], suggestions: DEFAULT_CHIPS };
  return {
    intent: "ORDER_TRACKING",
    reply: `Your recent orders:\n${recent.map((o) => `• ${o.number} — ${statusLabel(o.status)}`).join("\n")}`,
    links: [{ label: "All orders", href: "/account/orders" }],
    suggestions: DEFAULT_CHIPS,
  };
}

async function couponInfo(): Promise<AssistantReply> {
  const coupons = await listAvailableCoupons();
  if (coupons.length === 0) {
    return { intent: "COUPON_INFO", reply: "There are no public coupons right now — we add them often, so check back soon.", suggestions: DEFAULT_CHIPS };
  }
  const lines = coupons.slice(0, 5).map((c) => `• ${c.code} — ${c.label}${c.minSubtotalInr ? ` (min ₹${c.minSubtotalInr.toLocaleString("en-IN")})` : ""}`);
  return {
    intent: "COUPON_INFO",
    reply: `Here are the coupons you can use:\n${lines.join("\n")}\nEnter one in the coupon box at checkout.`,
    links: [{ label: "View coupons", href: "/account/coupons" }],
    suggestions: DEFAULT_CHIPS,
  };
}

async function categoryBrowse(): Promise<AssistantReply> {
  const cats = await prisma.category.findMany({ orderBy: { name: "asc" }, take: 8, select: { name: true, key: true } });
  if (cats.length === 0) {
    return { intent: "CATEGORY_BROWSE", reply: "Browse our full collection of handcrafted clay vessels.", links: [{ label: "View collection", href: "/collection" }], suggestions: DEFAULT_CHIPS };
  }
  return {
    intent: "CATEGORY_BROWSE",
    reply: "Browse by series:",
    links: [
      ...cats.map((c) => ({ label: c.name, href: `/collection?series=${encodeURIComponent(c.name)}` })),
      { label: "View all", href: "/collection" },
    ],
    suggestions: DEFAULT_CHIPS,
  };
}

/** Real product search → cards with image, name, price, and a View link. Never fabricates. */
async function productSearch(text: string): Promise<AssistantReply> {
  const stop = new Set(["show", "find", "search", "me", "a", "an", "the", "for", "looking", "do", "you", "have", "want", "need", "buy", "of", "price", "i", "some", "any", "please", "product", "products"]);
  const terms = text.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !stop.has(w));

  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);
  const active = products.filter((p) => p.status === "ACTIVE" && p.name.trim().length > 0);

  const scored = active
    .map((p) => {
      const hay = `${p.name} ${p.series}`.toLowerCase();
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { p, score };
    })
    .filter((x) => terms.length === 0 || x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (scored.length === 0) {
    return {
      intent: "PRODUCT_SEARCH",
      reply: "I couldn't find a match for that. Browse the full collection or tell me a series name (e.g. Torsa, Semina).",
      links: [{ label: "View collection", href: "/collection" }],
      suggestions: FALLBACK_CHIPS,
    };
  }

  const cards: ProductCard[] = scored.map(({ p }) => ({
    name: p.name,
    price: cardPrice(p, pricing),
    image: p.imgs[0] ?? "",
    href: `/products/${p.slug}`,
  }));

  return {
    intent: "PRODUCT_SEARCH",
    reply: cards.length === 1 ? "Here's what I found:" : `Here ${cards.length === 1 ? "is" : "are"} ${cards.length} pieces you might like:`,
    products: cards,
    suggestions: DEFAULT_CHIPS,
  };
}

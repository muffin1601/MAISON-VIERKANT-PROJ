/**
 * Catalogue data layer for the public storefront.
 *
 * Production path: reads from Supabase/Postgres via Prisma.
 * Resilience path: if the DB is unreachable (e.g. Supabase creds not yet wired), it
 * transparently falls back to the bundled prototype data so the site renders IDENTICALLY.
 * Either way the shape returned is the same, and pricing always runs through PricingService.
 */
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";
import {
  calcINR,
  DEFAULT_PRICING,
  type PricingConfig,
} from "@/services/pricing/PricingService";
import {
  PRODUCTS as PROTO_PRODUCTS,
  PRODUCT_MODELS as PROTO_MODELS,
  PROJS as PROTO_PROJS,
} from "../../../prisma/data/catalogue";

export interface ModelView {
  code: string;
  eur: number;
  dims: string;
}
export interface ProductView {
  id: string;
  code: string;
  slug: string;
  series: string;
  name: string;
  desc: string;
  dims: string;
  eurPrice: number;
  status: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  imgs: string[];
  drawings: string[];
  documents: DocumentView[];
  finishes: string[];
  models: ModelView[];
}
export interface DocumentView {
  id?: string; // present for persisted documents (absent for in-flight PDF imports)
  url: string;
  filename: string;
  kind: string;
  mimeType: string | null;
  sizeBytes: number | null;
  bucket: string | null;
  storageKey: string | null;
}
export interface ProjectView {
  name: string;
  location: string;
  summary: string;
  imageUrl: string;
}

// Shapes of the bundled prototype data (fallback source).
interface ProtoProduct {
  id: string;
  series: string;
  name: string;
  desc?: string;
  dims?: string;
  finishes: string[];
  eurPrice: number;
  stock?: number;
  imgs: string[];
}
interface ProtoProj {
  loc: string;
  name: string;
  desc: string;
  img: string;
}

// ---- fallback (prototype) ----
function uniqueSlugger() {
  const used = new Set<string>();
  return (name: string, id: string) => {
    const base = slugify(name || id) || "series";
    let s = base;
    let i = 2;
    while (used.has(s)) s = `${base}-${i++}`;
    used.add(s);
    return s;
  };
}

function fallbackProducts(): ProductView[] {
  const nextSlug = uniqueSlugger();
  return (PROTO_PRODUCTS as ProtoProduct[]).map((p) => ({
    id: p.id,
    code: p.id,
    slug: nextSlug(p.name, p.id),
    series: p.series,
    name: p.name,
    desc: p.desc ?? "",
    dims: p.dims ?? "",
    eurPrice: p.eurPrice ?? 0,
    status: "ACTIVE",
    featured: false,
    seoTitle: "",
    seoDescription: "",
    imgs: p.imgs ?? [],
    drawings: [],
    documents: [],
    finishes: p.finishes ?? [],
    models: ((PROTO_MODELS as Record<string, ModelView[]>)[p.id] ?? []).map((m) => ({
      code: m.code,
      eur: m.eur,
      dims: m.dims,
    })),
  }));
}

// ---- public API ----
export async function getActivePricing(): Promise<PricingConfig> {
  try {
    const rule = await prisma.pricingRule.findFirst({ where: { isActive: true } });
    if (!rule) return DEFAULT_PRICING;
    return {
      rate: Number(rule.rate),
      discountPct: Number(rule.discountPct),
      transportPct: Number(rule.transportPct),
      packingFlat: Number(rule.packingFlat),
      dutyPct: Number(rule.dutyPct),
      swsPct: Number(rule.swsPct),
      gstPct: Number(rule.gstPct),
      profitPct: Number(rule.profitPct),
      dealerMarkupPct: Number(rule.dealerMarkupPct),
    };
  } catch {
    return DEFAULT_PRICING;
  }
}

export async function getProducts(): Promise<ProductView[]> {
  try {
    const rows = await prisma.product.findMany({
      include: {
        category: true,
        images: { orderBy: { sort: "asc" } },
        documents: { orderBy: { sort: "asc" } },
        variants: true,
        finishes: { include: { finish: true } },
      },
      orderBy: { name: "asc" },
    });
    if (!rows.length) return fallbackProducts();
    return rows.map((p) => ({
      id: p.id,
      code: p.code,
      slug: p.slug,
      series: p.category?.name ?? "",
      name: p.name,
      desc: p.description ?? "",
      dims: p.dimsSummary ?? "",
      eurPrice: Number(p.eurPrice),
      status: p.status,
      featured: p.featured,
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      imgs: p.images.filter((i) => i.type !== "DRAWING").map((i) => i.url),
      drawings: p.images.filter((i) => i.type === "DRAWING").map((i) => i.url),
      documents: p.documents.map((doc) => ({
        id: doc.id,
        url: doc.url,
        filename: doc.filename,
        kind: doc.kind,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        bucket: doc.bucket,
        storageKey: doc.storageKey,
      })),
      finishes: p.finishes.map((f) => f.finish.name),
      models: p.variants.map((v) => ({ code: v.code, eur: Number(v.eurPrice), dims: v.dims ?? "" })),
    }));
  } catch {
    return fallbackProducts();
  }
}

export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  const all = await getProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getProjects(): Promise<ProjectView[]> {
  try {
    const rows = await prisma.project.findMany({ orderBy: { sort: "asc" } });
    if (rows.length)
      return rows.map((r) => ({
        name: r.name,
        location: r.location,
        summary: r.summary,
        imageUrl: r.imageUrl,
      }));
  } catch {
    /* fall through */
  }
  return (PROTO_PROJS as ProtoProj[]).map((p) => ({
    name: p.name,
    location: p.loc,
    summary: p.desc,
    imageUrl: p.img,
  }));
}

/** Card price string, identical to prototype mkCard: "From ₹x" when multiple sizes. */
export function cardPrice(p: ProductView, pricing: PricingConfig): string {
  const min = cardMinINR(p, pricing);
  if (min === null) return "Price on request"; // no EUR price set yet
  const multi =
    p.models.filter((m) => m.eur > 0).length > 1 || (p.eurPrice > 0 && p.models.length > 1);
  return multi
    ? `From ₹${min.toLocaleString("en-IN")}`
    : `₹${min.toLocaleString("en-IN")}`;
}

/** Lowest INR price for a product, or null if price-on-request. Used by sort/filter facets. */
export function cardMinINR(p: ProductView, pricing: PricingConfig): number | null {
  const prices = p.models.filter((m) => m.eur > 0).map((m) => calcINR(m.eur, pricing));
  const all = prices.length ? prices : p.eurPrice > 0 ? [calcINR(p.eurPrice, pricing)] : [];
  return all.length ? Math.min(...all) : null;
}

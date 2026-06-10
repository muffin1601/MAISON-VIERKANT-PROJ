import { z } from "zod";

export const quoteLineSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().default(""),
  variantCode: z.string().default(""),
  finish: z.string().default(""),
  qty: z.number().int().positive().default(1),
  unitInr: z.number().nonnegative().default(0),
});

export const quoteSchema = z.object({
  id: z.string().optional(),
  customer: z.object({
    name: z.string().min(1, "Customer name required"),
    company: z.string().optional().default(""),
    email: z.string().optional().default(""),
    phone: z.string().optional().default(""),
    addr1: z.string().optional().default(""),
    addr2: z.string().optional().default(""),
    city: z.string().optional().default(""),
    state: z.string().optional().default(""),
    pin: z.string().optional().default(""),
    country: z.string().optional().default("India"),
  }),
  discountPct: z.number().min(0).max(60).default(0),
  lines: z.array(quoteLineSchema).min(1, "Add at least one line"),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

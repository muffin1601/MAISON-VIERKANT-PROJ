import { z } from "zod";

export const modelSchema = z.object({
  code: z.string().min(1, "Model code required"),
  eur: z.number().nonnegative(),
  dims: z.string().optional().default(""),
});

export const documentSchema = z.object({
  url: z.string().min(1),
  filename: z.string().min(1),
  kind: z.string().default("DOCUMENT"),
  mimeType: z.string().optional().nullable(),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
  bucket: z.string().optional().nullable(),
  storageKey: z.string().optional().nullable(),
});
export type DocumentInput = z.infer<typeof documentSchema>;

export const productSchema = z.object({
  id: z.string().optional(), // present when editing
  series: z.string().min(1, "Series is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  eurPrice: z.number().nonnegative().default(0),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).default("ACTIVE"),
  featured: z.boolean().optional().default(false),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  heroImg: z.string().optional().default(""),
  gallery: z.array(z.string()).optional().default([]),
  drawings: z.array(z.string()).optional().default([]),
  documents: z.array(documentSchema).optional().default([]),
  finishes: z.array(z.string()).optional().default([]),
  models: z.array(modelSchema).optional().default([]),
  stock: z.number().int().nonnegative().optional().default(0),
});

export type ProductInput = z.infer<typeof productSchema>;

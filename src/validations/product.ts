import { z } from "zod";

export const modelSchema = z.object({
  code: z.string().min(1, "Model code required"),
  eur: z.number().nonnegative(),
  dims: z.string().optional().default(""),
});

export const productSchema = z.object({
  id: z.string().optional(), // present when editing
  series: z.string().min(1, "Series is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  eurPrice: z.number().nonnegative().default(0),
  heroImg: z.string().optional().default(""),
  gallery: z.array(z.string()).optional().default([]),
  finishes: z.array(z.string()).optional().default([]),
  models: z.array(modelSchema).optional().default([]),
  stock: z.number().int().nonnegative().optional().default(0),
});

export type ProductInput = z.infer<typeof productSchema>;

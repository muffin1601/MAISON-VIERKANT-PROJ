import { z } from "zod";

export const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().default(""),
  company: z.string().optional().default(""),
  type: z.string().optional().default(""),
  message: z.string().optional().default(""),
  represent: z.string().optional().default(""),
  source: z.enum(["CATALOGUE", "CONTACT", "TRADE"]).default("CATALOGUE"),
});

export type LeadInput = z.infer<typeof leadSchema>;

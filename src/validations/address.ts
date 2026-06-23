import { z } from "zod";

/**
 * Address book validation. India-centric: 10-digit phone, 6-digit PIN.
 * Shared by the API route and (via inferred types) the client form.
 */
export const addressInputSchema = z.object({
  label: z.string().trim().max(40).optional().default(""),
  name: z.string().trim().min(2, "Enter the recipient's name").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  company: z.string().trim().max(120).optional().default(""),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Enter a valid GSTIN")
    .optional()
    .or(z.literal("")),
  line1: z.string().trim().min(3, "Enter address line 1").max(200),
  line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2, "Enter the city").max(80),
  state: z.string().trim().min(2, "Enter the state").max(80),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code"),
  country: z.string().trim().max(80).optional().default("India"),
  isDefault: z.boolean().optional(),
});

export type AddressInput = z.infer<typeof addressInputSchema>;

/** Partial update — every field optional, but at least one must be present. */
export const addressPatchSchema = addressInputSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "No fields to update" },
);

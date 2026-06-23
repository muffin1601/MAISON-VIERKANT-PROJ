import { z } from "zod";

/** Strong password policy: 8–72 chars, with upper, lower, and a digit. */
export const strongPassword = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "Too long")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

export const profilePatchSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(120).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
      .optional()
      .or(z.literal("")),
  })
  .refine((v) => v.name !== undefined || v.phone !== undefined, { message: "Nothing to update" });

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: strongPassword,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Choose a password different from your current one",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

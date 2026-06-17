import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long"); // bcrypt truncates beyond 72 bytes

export const registerSchema = z.object({
  name: z.string().min(2, "Enter your name").max(120),
  email: z.string().email("Enter a valid email"),
  phone: z.string().max(20).optional().or(z.literal("")),
  company: z.string().max(160).optional().or(z.literal("")),
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid reset link"),
  password,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

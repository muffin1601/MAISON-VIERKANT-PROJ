import { env, appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/client";
import {
  welcomeEmail,
  passwordResetEmail,
  orderConfirmationEmail,
  orderStatusEmail,
  adminNewLeadEmail,
  adminNewOrderEmail,
  type OrderEmailLine,
} from "@/lib/email/templates";

/**
 * High-level, fire-and-forget notification helpers. Each resolves to a boolean
 * (sent / not sent) and never throws — callers should not await-block critical
 * paths on email, but may await to surface logs.
 */

export function sendWelcomeEmail(to: string, name: string) {
  const { subject, html } = welcomeEmail(name);
  return sendEmail({ to, subject, html });
}

export function sendPasswordResetEmail(to: string, name: string, token: string) {
  const resetUrl = `${appUrl}/account/reset-password?token=${encodeURIComponent(token)}`;
  const { subject, html } = passwordResetEmail(name, resetUrl);
  return sendEmail({ to, subject, html });
}

export function sendOrderConfirmationEmail(opts: {
  to: string;
  name: string;
  number: string;
  items: OrderEmailLine[];
  totalInr: number;
  advanceInr: number;
  method: "razorpay" | "cod" | "mock";
}) {
  const { subject, html } = orderConfirmationEmail({
    ...opts,
    orderUrl: `${appUrl}/account/orders`,
  });
  return sendEmail({ to: opts.to, subject, html });
}

export function sendOrderStatusEmail(opts: {
  to: string;
  name: string;
  number: string;
  status: string;
  trackingNumber?: string | null;
}) {
  const { subject, html } = orderStatusEmail({ ...opts, orderUrl: `${appUrl}/account/orders` });
  return sendEmail({ to: opts.to, subject, html });
}

export function notifyAdminNewLead(opts: Parameters<typeof adminNewLeadEmail>[0]) {
  if (!env.ADMIN_NOTIFY_EMAIL) return Promise.resolve(false);
  const { subject, html } = adminNewLeadEmail(opts);
  return sendEmail({ to: env.ADMIN_NOTIFY_EMAIL, subject, html, replyTo: opts.email ?? undefined });
}

export function notifyAdminNewOrder(opts: Parameters<typeof adminNewOrderEmail>[0]) {
  if (!env.ADMIN_NOTIFY_EMAIL) return Promise.resolve(false);
  const { subject, html } = adminNewOrderEmail(opts);
  return sendEmail({ to: env.ADMIN_NOTIFY_EMAIL, subject, html });
}

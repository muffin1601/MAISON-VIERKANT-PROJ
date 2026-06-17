import { Resend } from "resend";
import { env, emailReady } from "@/lib/env";
import { logger } from "@/lib/logger";

const resend = emailReady ? new Resend(env.RESEND_API_KEY) : null;

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Send a transactional email via Resend. When RESEND_API_KEY is not configured
 * the message is logged to the server console instead of sent, so local/preview
 * deployments still complete every flow end-to-end without a paid dependency.
 *
 * Never throws: email is a side-effect and must not break the request that
 * triggered it (order creation, registration, etc.). Failures are logged.
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<boolean> {
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) return false;

  if (!resend) {
    logger.info({ to: recipients, subject }, "[email:console] (RESEND_API_KEY unset — not sent)");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: recipients,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      logger.error({ err: error, to: recipients, subject }, "Resend send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, to: recipients, subject }, "Resend threw");
    return false;
  }
}

import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Bank / UPI details shown to customers for offline payment. Stored as a single JSON
 * row in the Setting table (key = "payment.bank"), fully editable from the admin panel
 * with no code change required.
 */
export interface PaymentSettings {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  swift: string;
  branch: string;
  upiId: string;
  upiQrUrl: string;
  /** Free-text extra instructions shown beneath the bank block. */
  instructions: string;
}

export const PAYMENT_SETTINGS_KEY = "payment.bank";

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  bankName: "",
  accountHolder: "Maison Vierkant",
  accountNumber: "",
  ifsc: "",
  swift: "",
  branch: "",
  upiId: "",
  upiQrUrl: "",
  instructions:
    "Please use your Order Number as the payment reference, then upload your payment proof below so our team can verify it.",
};

/** Read the configured payment settings, merged over defaults. Never throws. */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: PAYMENT_SETTINGS_KEY } });
    if (!row) return DEFAULT_PAYMENT_SETTINGS;
    return { ...DEFAULT_PAYMENT_SETTINGS, ...(row.value as Partial<PaymentSettings>) };
  } catch {
    return DEFAULT_PAYMENT_SETTINGS;
  }
}

/** True once at least one payable channel (bank account or UPI) is configured. */
export function paymentSettingsReady(s: PaymentSettings): boolean {
  return Boolean((s.accountNumber && s.ifsc) || s.upiId);
}

/** Persist payment settings (admin only — caller must enforce permission). */
export async function savePaymentSettings(value: PaymentSettings): Promise<void> {
  await prisma.setting.upsert({
    where: { key: PAYMENT_SETTINGS_KEY },
    update: { value: value as object },
    create: { key: PAYMENT_SETTINGS_KEY, value: value as object },
  });
}

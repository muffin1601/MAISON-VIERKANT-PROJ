import "server-only";
import { prisma } from "@/lib/prisma";
import { fetchPaymentToken, deleteCardToken } from "@/services/payment/razorpayService";
import { logger } from "@/lib/logger";

/**
 * Saved-card vault helpers. We persist ONLY display fields + the Razorpay token
 * handle. Capture runs best-effort after a verified payment; it's a no-op unless
 * the customer chose to save the card and the account has tokenisation enabled.
 */

export interface SavedCardDto {
  id: string;
  network: string;
  last4: string;
  issuer: string;
  isDefault: boolean;
  expiry: string | null;
}

export async function listSavedCards(userId: string): Promise<SavedCardDto[]> {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) return [];
  const rows = await prisma.savedCard.findMany({
    where: { customerId: customer.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((c) => ({
    id: c.id,
    network: c.network ?? "Card",
    last4: c.last4 ?? "••••",
    issuer: c.issuer ?? "",
    isDefault: c.isDefault,
    expiry: c.expiryMonth && c.expiryYear ? `${String(c.expiryMonth).padStart(2, "0")}/${String(c.expiryYear).slice(-2)}` : null,
  }));
}

/** Persist a card token captured from a payment. Idempotent on the token id. */
export async function captureCardFromPayment(params: {
  customerId: string;
  razorpayCustomerId: string;
  paymentId: string;
}): Promise<void> {
  try {
    const token = await fetchPaymentToken(params.paymentId);
    if (!token) return;
    const count = await prisma.savedCard.count({ where: { customerId: params.customerId } });
    await prisma.savedCard.upsert({
      where: { razorpayTokenId: token.tokenId },
      create: {
        customerId: params.customerId,
        razorpayTokenId: token.tokenId,
        razorpayCustomerId: params.razorpayCustomerId,
        network: token.network,
        last4: token.last4,
        issuer: token.issuer,
        expiryMonth: token.expiryMonth,
        expiryYear: token.expiryYear,
        isDefault: count === 0,
      },
      update: {},
    });
  } catch (err) {
    logger.warn({ err }, "captureCardFromPayment failed");
  }
}

export async function removeSavedCard(userId: string, cardId: string): Promise<boolean> {
  const card = await prisma.savedCard.findUnique({
    where: { id: cardId },
    include: { customer: { select: { userId: true } } },
  });
  if (!card || card.customer.userId !== userId) return false;
  await deleteCardToken(card.razorpayCustomerId, card.razorpayTokenId); // best-effort vault delete
  await prisma.savedCard.delete({ where: { id: cardId } });
  // Promote another card to default if we removed the default.
  if (card.isDefault) {
    const next = await prisma.savedCard.findFirst({ where: { customerId: card.customerId }, orderBy: { createdAt: "desc" } });
    if (next) await prisma.savedCard.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return true;
}

export async function setDefaultCard(userId: string, cardId: string): Promise<boolean> {
  const card = await prisma.savedCard.findUnique({
    where: { id: cardId },
    include: { customer: { select: { userId: true } } },
  });
  if (!card || card.customer.userId !== userId) return false;
  await prisma.$transaction([
    prisma.savedCard.updateMany({ where: { customerId: card.customerId }, data: { isDefault: false } }),
    prisma.savedCard.update({ where: { id: cardId }, data: { isDefault: true } }),
  ]);
  return true;
}

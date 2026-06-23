import "server-only";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { ProfilePatch } from "@/validations/profile";

/**
 * Profile read/write for the signed-in storefront user. Name/phone are mirrored
 * onto the linked CRM Customer so orders, quotes and emails stay consistent.
 */

export interface ProfileDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  image: string | null;
  membership: string; // derived loyalty tier shown in the account header
  memberSince: string | null;
  orderCount: number;
}

export async function getProfile(userId: string): Promise<ProfileDto | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      customer: { select: { phone: true, orders: { select: { id: true } } } },
    },
  });
  if (!user) return null;
  const orderCount = user.customer?.orders.length ?? 0;
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email,
    phone: user.customer?.phone ?? "",
    image: user.image,
    membership: deriveMembership(orderCount),
    memberSince: user.createdAt ? user.createdAt.toISOString() : null,
    orderCount,
  };
}

/** Simple spend-free loyalty tiers based on order count. */
function deriveMembership(orderCount: number): string {
  if (orderCount >= 10) return "Platinum";
  if (orderCount >= 3) return "Gold";
  if (orderCount >= 1) return "Silver";
  return "Member";
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<ProfileDto | null> {
  await prisma.$transaction(async (tx) => {
    if (patch.name !== undefined) {
      await tx.user.update({ where: { id: userId }, data: { name: patch.name } });
    }
    // Mirror name/phone onto the CRM Customer (create a minimal one if missing).
    const customer = await tx.customer.findUnique({ where: { userId }, select: { id: true } });
    const data: { name?: string; phone?: string } = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.phone !== undefined) data.phone = patch.phone || "";
    if (Object.keys(data).length > 0) {
      if (customer) {
        await tx.customer.update({ where: { id: customer.id }, data });
      } else {
        const u = await tx.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
        await tx.customer.create({
          data: { userId, name: data.name ?? u?.name ?? u?.email ?? "Customer", email: u?.email, phone: data.phone },
        });
      }
    }
  });
  return getProfile(userId);
}

export type ChangePasswordResult = "OK" | "NO_PASSWORD" | "WRONG_PASSWORD";

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash) return "NO_PASSWORD";
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return "WRONG_PASSWORD";
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  // Invalidate any outstanding reset tokens once the password changes.
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  return "OK";
}

export async function setAvatar(userId: string, imageUrl: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { image: imageUrl } });
}

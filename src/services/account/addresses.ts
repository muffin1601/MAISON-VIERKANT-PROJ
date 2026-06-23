import "server-only";
import { prisma } from "@/lib/prisma";
import type { AddressInput } from "@/validations/address";

/**
 * DB-backed address book scoped to a storefront user's CRM Customer record.
 * Enforces the invariant "exactly one default per customer" inside transactions.
 */

/** The Customer row for a storefront user, creating a minimal one if absent. */
async function getOrCreateCustomer(userId: string) {
  const existing = await prisma.customer.findUnique({ where: { userId } });
  if (existing) return existing;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");
  return prisma.customer.create({
    data: { userId, name: user.name ?? user.email ?? "Customer", email: user.email },
  });
}

export interface AddressDto {
  id: string;
  label: string;
  name: string;
  phone: string;
  company: string;
  gstin: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

type AddressRow = {
  id: string;
  label: string | null;
  name: string | null;
  phone: string | null;
  company: string | null;
  gstin: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
};

function toDto(a: AddressRow): AddressDto {
  return {
    id: a.id,
    label: a.label ?? "",
    name: a.name ?? "",
    phone: a.phone ?? "",
    company: a.company ?? "",
    gstin: a.gstin ?? "",
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: a.country,
    isDefault: a.isDefault,
  };
}

export async function listAddresses(userId: string): Promise<AddressDto[]> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!customer) return [];
  const rows = await prisma.address.findMany({
    where: { customerId: customer.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return rows.map(toDto);
}

export async function createAddress(userId: string, input: AddressInput): Promise<AddressDto> {
  const customer = await getOrCreateCustomer(userId);
  const count = await prisma.address.count({ where: { customerId: customer.id } });
  const makeDefault = input.isDefault || count === 0; // first address is always default

  const created = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: {
        customerId: customer.id,
        type: "SHIPPING",
        label: input.label || null,
        name: input.name,
        phone: input.phone,
        company: input.company || null,
        gstin: input.gstin || null,
        line1: input.line1,
        line2: input.line2 || null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        country: input.country || "India",
        isDefault: makeDefault,
      },
    });
  });
  return toDto(created);
}

/** Confirm an address belongs to this user before mutating it. */
async function assertOwned(userId: string, addressId: string) {
  const addr = await prisma.address.findUnique({
    where: { id: addressId },
    select: { id: true, customerId: true, customer: { select: { userId: true } } },
  });
  if (!addr || addr.customer?.userId !== userId) return null;
  return addr;
}

export async function updateAddress(
  userId: string,
  addressId: string,
  patch: Partial<AddressInput>,
): Promise<AddressDto | null> {
  const owned = await assertOwned(userId, addressId);
  if (!owned) return null;

  const updated = await prisma.$transaction(async (tx) => {
    if (patch.isDefault === true) {
      await tx.address.updateMany({ where: { customerId: owned.customerId }, data: { isDefault: false } });
    }
    return tx.address.update({
      where: { id: addressId },
      data: {
        ...(patch.label !== undefined && { label: patch.label || null }),
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.phone !== undefined && { phone: patch.phone }),
        ...(patch.company !== undefined && { company: patch.company || null }),
        ...(patch.gstin !== undefined && { gstin: patch.gstin || null }),
        ...(patch.line1 !== undefined && { line1: patch.line1 }),
        ...(patch.line2 !== undefined && { line2: patch.line2 || null }),
        ...(patch.city !== undefined && { city: patch.city }),
        ...(patch.state !== undefined && { state: patch.state }),
        ...(patch.pincode !== undefined && { pincode: patch.pincode }),
        ...(patch.country !== undefined && { country: patch.country || "India" }),
        ...(patch.isDefault === true && { isDefault: true }),
      },
    });
  });
  return toDto(updated);
}

export async function deleteAddress(userId: string, addressId: string): Promise<boolean> {
  const owned = await assertOwned(userId, addressId);
  if (!owned) return false;
  await prisma.$transaction(async (tx) => {
    const wasDefault = await tx.address.findUnique({ where: { id: addressId }, select: { isDefault: true } });
    await tx.address.delete({ where: { id: addressId } });
    if (wasDefault?.isDefault) {
      // Promote the next-oldest address to default to preserve the invariant.
      const next = await tx.address.findFirst({
        where: { customerId: owned.customerId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  return true;
}

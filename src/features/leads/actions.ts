"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth/session";

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "WON",
  "LOST",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Admin lead-status update. Requires `leads.write`. */
export const updateLeadStatus = withPermission(
  "leads.write",
  async (_user, input: { id: string; status: LeadStatus }) => {
    if (!LEAD_STATUSES.includes(input.status)) throw new Error("Invalid status");
    await prisma.lead.update({ where: { id: input.id }, data: { status: input.status } });
    revalidatePath("/admin/leads");
    return { ok: true };
  },
);

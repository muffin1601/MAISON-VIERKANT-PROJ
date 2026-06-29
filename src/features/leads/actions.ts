"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth/session";
import { LEAD_STATUSES, type LeadStatus } from "./constants";

/** Admin lead-status update. Requires `leads.write`. */
export const updateLeadStatus = withPermission(
  "leads.write",
  async (_user, input: { id: string; status: LeadStatus }) => {
    if (!LEAD_STATUSES.includes(input.status)) throw new Error("Invalid status");
    try {
      await prisma.lead.update({ where: { id: input.id }, data: { status: input.status } });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
        return { ok: false as const, notFound: true as const };
      }
      throw err;
    }
    revalidatePath("/admin/leads");
    return { ok: true };
  },
);

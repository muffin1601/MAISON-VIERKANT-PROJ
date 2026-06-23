import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfile } from "@/services/account/profile";
import { AccountNav } from "@/features/account/AccountNav";
import { SupportCenter } from "@/features/support/SupportCenter";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

type TicketType = "SUPPORT" | "ORDER" | "RETURN" | "REFUND";
const VALID: TicketType[] = ["SUPPORT", "ORDER", "RETURN", "REFUND"];

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?callbackUrl=/account/support");
  const [profile, sp] = await Promise.all([getProfile(user.id), searchParams]);
  const type = (sp.type && VALID.includes(sp.type.toUpperCase() as TicketType) ? sp.type.toUpperCase() : "SUPPORT") as TicketType;

  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 56 }}>
        <h1 className="st" style={{ marginBottom: 4 }}>
          Help &amp; <em>Support</em>
        </h1>
        <AccountNav />
        <div style={{ marginTop: 24 }}>
          <SupportCenter
            defaultType={type}
            defaultOrder={sp.order ?? ""}
            name={profile?.name ?? user.name ?? ""}
            email={profile?.email ?? user.email ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

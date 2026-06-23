import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { AccountNav } from "@/features/account/AccountNav";
import { CouponsView } from "@/features/account/CouponsView";

export const metadata: Metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?callbackUrl=/account/coupons");
  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 56 }}>
        <h1 className="st" style={{ marginBottom: 4 }}>
          My <em>Coupons</em>
        </h1>
        <AccountNav />
        <div style={{ marginTop: 24 }}>
          <CouponsView />
        </div>
      </div>
    </div>
  );
}

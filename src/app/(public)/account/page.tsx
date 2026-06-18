import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getCustomerWithOrders } from "@/services/account/queries";
import { OrderList } from "@/features/account/OrderList";
import { AccountSignOut } from "@/features/account/AccountSignOut";
import { AccountNav } from "@/features/account/AccountNav";

export const metadata: Metadata = { title: "My Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?callbackUrl=/account");

  const customer = await getCustomerWithOrders(user.id);
  const recent = customer?.orders.slice(0, 3) ?? [];

  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 56 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 className="st" style={{ marginBottom: 4 }}>
              My <em>Account</em>
            </h1>
            <div style={{ fontSize: 13, color: "var(--ink4)" }}>
              {user.name || user.email}
            </div>
          </div>
          <AccountSignOut />
        </div>

        <AccountNav />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "28px 0 14px" }}>
          <div className="co-section-title" style={{ margin: 0 }}>
            Recent Orders
          </div>
          <Link href="/account/orders" style={{ fontSize: 12, color: "var(--gold)" }}>
            View all →
          </Link>
        </div>
        <OrderList orders={recent} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getCustomerWithOrders } from "@/services/account/queries";
import { getPaymentSettings } from "@/services/settings/paymentSettings";
import { OrderList } from "@/features/account/OrderList";

export const metadata: Metadata = { title: "Order History" };
export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?callbackUrl=/account/orders");

  const [customer, settings] = await Promise.all([
    getCustomerWithOrders(user.id),
    getPaymentSettings(),
  ]);

  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 56 }}>
        <Link href="/account" style={{ fontSize: 12, color: "var(--gold)" }}>
          ← Back to account
        </Link>
        <h1 className="st" style={{ margin: "10px 0 24px" }}>
          Order <em>History</em>
        </h1>
        <OrderList
          orders={customer?.orders ?? []}
          settings={settings}
          customerEmail={user.email ?? customer?.email ?? ""}
        />
      </div>
    </div>
  );
}

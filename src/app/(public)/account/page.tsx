import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getCustomerWithOrders } from "@/services/account/queries";
import { getProfile } from "@/services/account/profile";
import { getPaymentSettings } from "@/services/settings/paymentSettings";
import { OrderList } from "@/features/account/OrderList";
import { AccountMenuGrid } from "@/features/account/AccountMenuGrid";

export const metadata: Metadata = { title: "My Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?callbackUrl=/account");

  const [customer, settings, profile] = await Promise.all([
    getCustomerWithOrders(user.id),
    getPaymentSettings(),
    getProfile(user.id),
  ]);
  const recent = customer?.orders.slice(0, 3) ?? [];
  const initials = (profile?.name || user.name || user.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 880, paddingTop: 32, paddingBottom: 56 }}>
        {/* Identity header */}
        <div className="acct-hero">
          <div className="acct-hero-avatar" aria-hidden>
            {profile?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.image} alt="" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="acct-hero-id">
            <div className="acct-hero-name">{profile?.name || user.name || "Welcome"}</div>
            <div className="acct-hero-meta">{profile?.email || user.email}</div>
            {profile?.phone && <div className="acct-hero-meta">+91 {profile.phone}</div>}
          </div>
          <span className="acct-hero-badge">{profile?.membership ?? "Member"}</span>
        </div>

        {/* Menu cards */}
        <AccountMenuGrid />

        {/* Recent orders */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "32px 0 14px" }}>
          <div className="co-section-title" style={{ margin: 0 }}>
            Recent Orders
          </div>
          <Link href="/account/orders" style={{ fontSize: 12, color: "var(--gold)" }}>
            View all →
          </Link>
        </div>
        <OrderList orders={recent} settings={settings} customerEmail={user.email ?? customer?.email ?? ""} />
      </div>
    </div>
  );
}

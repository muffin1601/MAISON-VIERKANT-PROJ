import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { AccountNav } from "@/features/account/AccountNav";
import { AddressBookView } from "@/features/account/AddressBookView";

export const metadata: Metadata = { title: "Addresses" };
export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?callbackUrl=/account/addresses");

  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 820, paddingTop: 32, paddingBottom: 56 }}>
        <h1 className="st" style={{ marginBottom: 16 }}>
          My <em>Account</em>
        </h1>
        <AccountNav />
        <div className="co-section-title" style={{ marginTop: 24 }}>
          Saved Addresses
        </div>
        <AddressBookView />
      </div>
    </div>
  );
}

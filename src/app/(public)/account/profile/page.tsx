import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { AccountNav } from "@/features/account/AccountNav";
import { AccountSignOut } from "@/features/account/AccountSignOut";
import { ProfileView } from "@/features/account/ProfileView";

export const metadata: Metadata = { title: "Edit Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?callbackUrl=/account/profile");

  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 56 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <h1 className="st" style={{ marginBottom: 4 }}>
            Edit <em>Profile</em>
          </h1>
          <AccountSignOut />
        </div>
        <AccountNav />
        <div style={{ marginTop: 24 }}>
          <ProfileView />
        </div>
      </div>
    </div>
  );
}

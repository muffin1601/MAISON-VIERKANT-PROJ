import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { AccountNav } from "@/features/account/AccountNav";
import { SavedCardsView } from "@/features/account/SavedCardsView";

export const metadata: Metadata = { title: "Saved Cards" };
export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?callbackUrl=/account/cards");
  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 56 }}>
        <h1 className="st" style={{ marginBottom: 4 }}>
          Saved <em>Cards</em>
        </h1>
        <AccountNav />
        <div style={{ marginTop: 24 }}>
          <SavedCardsView />
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { allowedNav } from "@/lib/auth/rbac";
import { AdminNav } from "@/components/layout/AdminNav";
import { SignOutButton } from "@/components/layout/SignOutButton";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin Console",
  SALES_MANAGER: "Sales Manager",
  SALES_EXECUTIVE: "Sales Console",
  INVENTORY_MANAGER: "Inventory Manager",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role === "CUSTOMER") redirect("/login");

  const nav = allowedNav(user.permissions);

  return (
    // Mirrors prototype #admin-panel (display:flex row) using verbatim classes.
    <div id="admin-panel" style={{ display: "flex" }}>
      <div className="a-sidebar">
        <div className="a-sb-logo">
          <div className="a-sb-name">Maison Vierkant</div>
          <div className="a-sb-sub">{ROLE_LABELS[user.role] ?? "Console"}</div>
        </div>
        <AdminNav items={nav} />
        <div className="a-exit">
          <SignOutButton />
        </div>
      </div>
      <div className="a-main">{children}</div>
    </div>
  );
}

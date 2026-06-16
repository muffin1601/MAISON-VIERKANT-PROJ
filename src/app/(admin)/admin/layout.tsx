import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { allowedNav } from "@/lib/auth/rbac";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

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
      <AdminSidebar items={nav} roleLabel={ROLE_LABELS[user.role] ?? "Console"} />
      <div className="a-main">{children}</div>
    </div>
  );
}

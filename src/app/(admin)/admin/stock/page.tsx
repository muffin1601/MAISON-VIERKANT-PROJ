import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getStockRows } from "@/services/admin/queries";
import { StockTable } from "@/features/inventory/StockTable";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "inventory.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Stock</div>
        <div className="a-sub">You do not have access to inventory.</div>
      </div>
    );
  }

  const rows = await getStockRows();
  const canEdit = hasPermission(user.permissions, "inventory.write");

  return (
    <div className="a-page active">
      <div className="a-title">Stock</div>
      <div className="a-sub">Inventory levels across all series · Adjust stock in real time</div>
      <div className="a-card" style={{ overflowX: "auto" }}>
        <StockTable rows={rows} canEdit={canEdit} />
      </div>
    </div>
  );
}

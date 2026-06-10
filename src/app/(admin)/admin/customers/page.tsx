import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getCustomers } from "@/services/admin/queries";
import { CustomersView } from "@/features/customers/CustomersView";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "customers.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Customers</div>
        <div className="a-sub">You do not have access to customers.</div>
      </div>
    );
  }

  const customers = await getCustomers();

  return (
    <div className="a-page active">
      <div className="a-title">Customers</div>
      <div className="a-sub">
        Manage your client database · Click any customer to view their quote history
      </div>
      <CustomersView customers={customers} />
    </div>
  );
}

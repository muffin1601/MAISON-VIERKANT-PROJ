import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getLeads } from "@/services/admin/queries";
import { LeadsView } from "@/features/leads/LeadsView";

export const dynamic = "force-dynamic";

/** Captured catalogue & contact leads — searchable, filterable, exportable. */
export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "leads.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Catalogue Leads</div>
        <div className="a-sub">You do not have access to leads.</div>
      </div>
    );
  }

  const leads = await getLeads();
  const canWrite = hasPermission(user.permissions, "leads.write");

  return (
    <div className="a-page active">
      <div className="a-title">Catalogue Leads</div>
      <div className="a-sub">Catalogue requests &amp; contact enquiries — search, filter, export, and manage status</div>
      <LeadsView leads={leads} canWrite={canWrite} />
    </div>
  );
}

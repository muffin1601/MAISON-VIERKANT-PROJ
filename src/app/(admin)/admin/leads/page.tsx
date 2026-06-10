import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getLeads } from "@/services/admin/queries";

export const dynamic = "force-dynamic";

/** Faithful port of prototype renderLeadsT — captured catalogue & contact leads. */
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

  return (
    <div className="a-page active">
      <div className="a-title">Catalogue Leads</div>
      <div className="a-sub">People who requested the Atelier Vierkant catalogue</div>
      <div className="a-card" style={{ overflowX: "auto" }}>
        <table className="a-table" id="leads-table">
          {leads.length === 0 ? (
            <>
              <thead>
                <tr>
                  <th>No leads yet</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: "var(--ink4)", fontSize: 12 }}>
                    Catalogue requests will appear here after submission.
                  </td>
                </tr>
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Type</th>
                  <th>Company</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11, color: "var(--ink4)" }}>{l.date}</td>
                    <td style={{ fontWeight: 400 }}>{l.name}</td>
                    <td>{l.email}</td>
                    <td>{l.phone}</td>
                    <td>{l.type}</td>
                    <td>{l.company}</td>
                    <td style={{ fontSize: 11, color: "var(--ink3)" }}>{l.source}</td>
                    <td>
                      <span className="sbadge s-confirmed">{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
}

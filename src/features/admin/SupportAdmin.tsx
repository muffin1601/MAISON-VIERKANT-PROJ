"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/toast";

export interface TicketRow {
  id: string;
  type: string;
  status: string;
  orderNumber: string | null;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  createdAt: string;
}

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const TYPE_COLOR: Record<string, string> = { RETURN: "#7a5cc0", REFUND: "#b71c1c", ORDER: "#1565c0", SUPPORT: "#6a4a1a" };

/** Admin support / returns / refunds queue with inline status control. */
export function SupportAdmin({ initial }: { initial: TicketRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = filter === "ALL" ? initial : initial.filter((t) => t.type === filter);

  async function setStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/admin/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      showToast("Status updated.");
      router.refresh();
    } catch {
      showToast("Could not update.");
    }
  }

  return (
    <>
      <div className="sc-tabs" style={{ marginBottom: 14 }}>
        {["ALL", "SUPPORT", "ORDER", "RETURN", "REFUND"].map((t) => (
          <button key={t} className={`sc-tab${filter === t ? " active" : ""}`} onClick={() => setFilter(t)}>
            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <div className="a-card" style={{ overflowX: "auto" }}>
        <table className="a-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Subject</th>
              <th>From</th>
              <th>Order</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{ color: "var(--ink4)" }}>No tickets.</td></tr>}
            {rows.map((t) => (
              <Fragment key={t.id}>
                <tr onClick={() => setOpenId(openId === t.id ? null : t.id)} style={{ cursor: "pointer" }}>
                  <td><span style={{ color: TYPE_COLOR[t.type] ?? "#666", fontWeight: 600, fontSize: 11 }}>{t.type}</span></td>
                  <td>{t.subject}</td>
                  <td style={{ fontSize: 12 }}>{t.name}<br /><span style={{ color: "var(--ink4)" }}>{t.email}</span></td>
                  <td style={{ fontSize: 12 }}>{t.orderNumber ?? "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--ink4)" }}>{new Date(t.createdAt).toLocaleDateString("en-IN")}</td>
                  <td>
                    <select
                      value={t.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setStatus(t.id, e.target.value)}
                      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 2 }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  </td>
                </tr>
                {openId === t.id && (
                  <tr>
                    <td colSpan={6} style={{ background: "var(--cream)", fontSize: 13, padding: "12px 16px" }}>
                      <strong>Message:</strong> {t.message}
                      {t.phone && <div style={{ marginTop: 6, color: "var(--ink4)" }}>Phone: {t.phone}</div>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

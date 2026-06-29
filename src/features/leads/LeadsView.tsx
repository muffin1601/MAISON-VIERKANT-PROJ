"use client";

import { useMemo, useState, useTransition } from "react";
import { showToast } from "@/lib/toast";
import { updateLeadStatus, LEAD_STATUSES, type LeadStatus } from "./actions";

export interface LeadRow {
  id: string;
  date: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  company: string;
  source: string;
  status: string;
}

const SOURCES = ["CATALOGUE", "CONTACT", "TRADE"];

/** Admin leads: search + status/source filters + CSV export + inline status update. */
export function LeadsView({
  leads,
  canWrite,
  loadFailed = false,
}: {
  leads: LeadRow[];
  canWrite: boolean;
  /** Set when the server query failed; shows a non-blocking error banner. */
  loadFailed?: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [source, setSource] = useState("ALL");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== "ALL" && l.status !== status) return false;
      if (source !== "ALL" && l.source !== source) return false;
      if (!needle) return true;
      return (
        l.name.toLowerCase().includes(needle) ||
        l.email.toLowerCase().includes(needle) ||
        l.phone.toLowerCase().includes(needle) ||
        l.company.toLowerCase().includes(needle) ||
        l.type.toLowerCase().includes(needle)
      );
    });
  }, [leads, q, status, source]);

  function exportCsv() {
    if (list.length === 0) {
      showToast("Nothing to export for the current filters.");
      return;
    }
    const headers = ["Date", "Name", "Email", "Phone", "Type", "Company", "Source", "Status"];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = list.map((l) =>
      [l.date, l.name, l.email, l.phone, l.type, l.company, l.source, l.status].map(esc).join(","),
    );
    const csv = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {loadFailed && (
        <div
          role="alert"
          className="a-card"
          style={{
            marginBottom: 16,
            borderLeft: "3px solid var(--gold)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--ink2)" }}>
            Unable to load catalogue leads right now. Please try again later.
          </span>
          <button
            type="button"
            className="a-btn-g"
            style={{ width: "auto", padding: "8px 16px", margin: 0 }}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <input
          className="a-input"
          style={{ flex: 1, minWidth: 200, margin: 0 }}
          placeholder="Search name, email, phone, company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search leads"
        />
        <select
          className="a-input"
          style={{ width: 150, margin: 0, fontSize: 11 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="a-input"
          style={{ width: 150, margin: 0, fontSize: 11 }}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Filter by source"
        >
          <option value="ALL">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          className="a-btn-g"
          style={{ width: "auto", padding: "8px 16px", margin: 0 }}
          onClick={exportCsv}
        >
          ↓ Export CSV
        </button>
      </div>

      <div style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 10 }}>
        {list.length} of {leads.length} lead{leads.length === 1 ? "" : "s"}
      </div>

      <div className="a-card" style={{ overflowX: "auto" }}>
        <table className="a-table">
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
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ color: "var(--ink4)", fontSize: 12, padding: 20, textAlign: "center" }}>
                  No leads match the current filters.
                </td>
              </tr>
            ) : (
              list.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontSize: 11, color: "var(--ink4)" }}>{l.date}</td>
                  <td style={{ fontWeight: 400 }}>{l.name}</td>
                  <td>{l.email}</td>
                  <td>{l.phone}</td>
                  <td>{l.type}</td>
                  <td>{l.company}</td>
                  <td style={{ fontSize: 11, color: "var(--ink3)" }}>{l.source}</td>
                  <td>
                    <LeadStatusCell id={l.id} status={l.status} canWrite={canWrite} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LeadStatusCell({ id, status, canWrite }: { id: string; status: string; canWrite: boolean }) {
  const [value, setValue] = useState(status.toUpperCase());
  const [pending, startTransition] = useTransition();

  if (!canWrite) {
    return <span className="sbadge s-confirmed">{status}</span>;
  }

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await updateLeadStatus({ id, status: next as LeadStatus });
        showToast(`Lead → ${next}`);
      } catch {
        setValue(prev);
        showToast("Could not update lead status.");
      }
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className="sbadge s-confirmed"
      style={{ border: "1px solid var(--cream3)", borderRadius: 2, padding: "4px 8px", fontSize: 11 }}
      aria-label="Lead status"
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

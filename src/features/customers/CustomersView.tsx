"use client";

import { useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  orders: number;
  quotes: number;
  value: number;
}

/** Faithful port of prototype custRender (toolbar + stats + card grid). */
export function CustomersView({ customers }: { customers: CustomerRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");

  const list = useMemo(() => {
    let l = customers.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.company.toLowerCase().includes(q.toLowerCase()) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q.toLowerCase()),
    );
    l = [...l].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "company") return a.company.localeCompare(b.company);
      if (sort === "quotes") return b.quotes - a.quotes;
      if (sort === "value") return b.value - a.value;
      return 0;
    });
    return l;
  }, [customers, q, sort]);

  const totalValue = customers.reduce((s, c) => s + c.value, 0);

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <input
          className="a-input"
          style={{ flex: 1, minWidth: 200, margin: 0 }}
          placeholder="Search name, company, phone, city…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="a-input"
          style={{ width: 150, margin: 0, fontSize: 11 }}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">Name A–Z</option>
          <option value="company">Company A–Z</option>
          <option value="quotes">Most Quotes</option>
          <option value="value">Highest Value</option>
        </select>
        <button
          className="a-btn-g"
          style={{ width: "auto", padding: "8px 16px", margin: 0 }}
          onClick={() => showToast("Add Customer — available in the Quotes module.")}
        >
          + Add Customer
        </button>
      </div>

      <div
        id="cust-stats"
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          marginBottom: 16,
          padding: "12px 16px",
          background: "var(--cream2)",
          borderRadius: 4,
          border: "1px solid var(--cream3)",
        }}
      >
        <Stat label="Customers" value={String(customers.length)} />
        <Stat label="Total Orders" value={String(customers.reduce((s, c) => s + c.orders, 0))} />
        <Stat label="Total Value" value={fmt(totalValue)} />
      </div>

      <div
        id="cust-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
          gap: 14,
        }}
      >
        {list.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--ink4)" }}>
            No customers found.
          </div>
        ) : (
          list.map((c) => (
            <div className="a-card" key={c.id} style={{ padding: 16 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19 }}>{c.name}</div>
              {c.company && (
                <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 1 }}>{c.company}</div>
              )}
              <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 8, lineHeight: 1.8 }}>
                {c.phone && <div>{c.phone}</div>}
                {c.email && <div>{c.email}</div>}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--cream3)",
                  fontSize: 11,
                  color: "var(--ink4)",
                }}
              >
                <span>{c.orders} orders</span>
                <span>{c.quotes} quotes</span>
                <span style={{ marginLeft: "auto", color: "var(--ink)" }}>{fmt(c.value)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)" }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

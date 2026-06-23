"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/toast";

export interface CouponRow {
  id: string;
  code: string;
  type: string;
  value: number;
  minSubtotalInr: number;
  maxDiscountInr: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
}

/** Admin coupon manager: create new codes + enable/disable existing ones. */
export function CouponAdmin({ initial }: { initial: CouponRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "",
    type: "PERCENT",
    value: "",
    minSubtotalInr: "",
    maxDiscountInr: "",
    usageLimit: "",
    perUserLimit: "1",
    expiresAt: "",
  });
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function create() {
    if (!form.code.trim() || !form.value) {
      showToast("Enter a code and a value.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          type: form.type,
          value: Number(form.value),
          minSubtotalInr: form.minSubtotalInr ? Number(form.minSubtotalInr) : 0,
          maxDiscountInr: form.maxDiscountInr ? Number(form.maxDiscountInr) : undefined,
          usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
          perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : 1,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed");
      showToast(`Coupon ${json.data.code} created.`);
      setForm({ code: "", type: "PERCENT", value: "", minSubtotalInr: "", maxDiscountInr: "", usageLimit: "", perUserLimit: "1", expiresAt: "" });
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not create coupon.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      showToast(isActive ? "Coupon disabled." : "Coupon enabled.");
      router.refresh();
    } catch {
      showToast("Could not update coupon.");
    }
  }

  return (
    <>
      <div className="a-card" style={{ marginBottom: 18 }}>
        <div className="co-section-title" style={{ marginTop: 0 }}>Create coupon</div>
        <div className="cpn-admin-form">
          <input placeholder="CODE" value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} />
          <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
            <option value="PERCENT">% off</option>
            <option value="FLAT">₹ flat</option>
          </select>
          <input placeholder={form.type === "PERCENT" ? "% value" : "₹ value"} inputMode="numeric" value={form.value} onChange={(e) => set({ value: e.target.value.replace(/[^0-9.]/g, "") })} />
          <input placeholder="Min order ₹" inputMode="numeric" value={form.minSubtotalInr} onChange={(e) => set({ minSubtotalInr: e.target.value.replace(/\D/g, "") })} />
          <input placeholder="Max disc ₹" inputMode="numeric" value={form.maxDiscountInr} onChange={(e) => set({ maxDiscountInr: e.target.value.replace(/\D/g, "") })} />
          <input placeholder="Total uses" inputMode="numeric" value={form.usageLimit} onChange={(e) => set({ usageLimit: e.target.value.replace(/\D/g, "") })} />
          <input placeholder="Per user" inputMode="numeric" value={form.perUserLimit} onChange={(e) => set({ perUserLimit: e.target.value.replace(/\D/g, "") })} />
          <input type="date" value={form.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} title="Expiry" />
          <button className="btn-primary" disabled={busy} onClick={create} style={{ padding: "9px 18px" }}>
            {busy ? "…" : "Create"}
          </button>
        </div>
      </div>

      <div className="a-card" style={{ overflowX: "auto" }}>
        <table className="a-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Min</th>
              <th>Used</th>
              <th>Expires</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 && (
              <tr><td colSpan={7} style={{ color: "var(--ink4)" }}>No coupons yet.</td></tr>
            )}
            {initial.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.code}</td>
                <td>{c.type === "PERCENT" ? `${c.value}%` : `₹${c.value.toLocaleString("en-IN")}`}{c.maxDiscountInr ? ` (max ₹${c.maxDiscountInr.toLocaleString("en-IN")})` : ""}</td>
                <td>{c.minSubtotalInr ? `₹${c.minSubtotalInr.toLocaleString("en-IN")}` : "—"}</td>
                <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                <td style={{ color: c.isActive ? "#2e7d32" : "#b71c1c" }}>{c.isActive ? "Active" : "Disabled"}</td>
                <td>
                  <button className="ci-link" onClick={() => toggle(c.id, c.isActive)}>
                    {c.isActive ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

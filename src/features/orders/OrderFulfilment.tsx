"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus, ORDER_STATUSES, type OrderStatus } from "./actions";
import { statusMeta } from "@/lib/orderStatus";
import { showToast } from "@/lib/toast";

/**
 * Admin order fulfilment control: status + tracking number + courier + tracking URL
 * in one inline form. Read-only badge when the admin lacks orders.write.
 */
export function OrderFulfilment({
  number,
  status,
  trackingNumber,
  courier,
  trackingUrl,
  canWrite,
}: {
  number: string;
  status: string;
  trackingNumber: string;
  courier: string;
  trackingUrl: string;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(status.toUpperCase());
  const [track, setTrack] = useState(trackingNumber);
  const [crr, setCrr] = useState(courier);
  const [url, setUrl] = useState(trackingUrl);
  const [pending, startTransition] = useTransition();
  const meta = statusMeta(value);

  const badge = (
    <span
      style={{
        fontSize: 10,
        letterSpacing: ".06em",
        color: meta.color,
        border: `1px solid ${meta.color}`,
        borderRadius: 20,
        padding: "3px 10px",
        background: "#fff",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );

  if (!canWrite) return badge;

  const options = ORDER_STATUSES.includes(value as OrderStatus) ? [...ORDER_STATUSES] : [value, ...ORDER_STATUSES];

  function save() {
    startTransition(async () => {
      try {
        const res = await updateOrderStatus({
          number,
          status: value as OrderStatus,
          trackingNumber: track,
          courier: crr,
          trackingUrl: url,
        });
        if (!res.ok) {
          showToast("Order not found.");
          return;
        }
        showToast(`Order ${number} updated. Customer notified.`);
        setOpen(false);
      } catch {
        showToast("Could not update order.");
      }
    });
  }

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
      {badge}
      <button type="button" className="ci-link" style={{ fontSize: 11 }} onClick={() => setOpen((v) => !v)}>
        {open ? "Close" : "Manage"}
      </button>
      {open && (
        <div className="ofl-pop">
          <label className="ofl-l">Status</label>
          <select value={value} onChange={(e) => setValue(e.target.value)} disabled={pending} className="ofl-in">
            {options.map((s) => (
              <option key={s} value={s}>
                {statusMeta(s).label}
              </option>
            ))}
          </select>
          <label className="ofl-l">Tracking number</label>
          <input className="ofl-in" value={track} onChange={(e) => setTrack(e.target.value)} placeholder="e.g. 1234567890" />
          <label className="ofl-l">Courier</label>
          <input className="ofl-in" value={crr} onChange={(e) => setCrr(e.target.value)} placeholder="e.g. Delhivery" />
          <label className="ofl-l">Tracking URL</label>
          <input className="ofl-in" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          <button className="btn-primary" style={{ marginTop: 8, padding: "8px 18px", fontSize: 12 }} disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save & notify"}
          </button>
        </div>
      )}
    </div>
  );
}

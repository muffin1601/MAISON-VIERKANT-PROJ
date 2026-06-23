"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { updateOrderStatus, type OrderStatus } from "./actions";
// NOTE: import the status array from the PLAIN lib, never from the "use server"
// actions module — non-async exports from a server-actions file are not real
// values on the client in a production build (caused "n.includes is not a function").
import { ADMIN_ASSIGNABLE_STATUSES, statusMeta } from "@/lib/orderStatus";
import { Portal } from "@/components/ui/Portal";
import { showToast } from "@/lib/toast";

const ORDER_STATUSES = ADMIN_ASSIGNABLE_STATUSES;

/**
 * Admin order fulfilment control. Shows the status badge inline + a "Manage" button
 * that opens a centered modal (portaled to <body>, so it's never clipped by the
 * table's horizontal-scroll container) to set status, tracking, courier & URL.
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
  const [value, setValue] = useState(String(status ?? "").toUpperCase());
  const [track, setTrack] = useState(trackingNumber);
  const [crr, setCrr] = useState(courier);
  const [url, setUrl] = useState(trackingUrl);
  const [pending, startTransition] = useTransition();
  const meta = statusMeta(value);

  // Lock body scroll + close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {badge}
      <button type="button" className="ci-link" style={{ fontSize: 11 }} onClick={() => setOpen(true)}>
        Manage
      </button>

      {open && (
        <Portal>
          <div className="ofl-overlay" role="dialog" aria-modal="true" aria-label={`Manage order ${number}`}>
            <button className="ofl-backdrop" aria-label="Close" onClick={() => setOpen(false)} />
            <div className="ofl-modal">
              <div className="ofl-modal-head">
                <div>
                  <div className="ofl-modal-title">Manage Order</div>
                  <div className="ofl-modal-sub">{number}</div>
                </div>
                <button className="ofl-modal-close" aria-label="Close" onClick={() => setOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="ofl-modal-body">
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
              </div>

              <div className="ofl-modal-foot">
                <button className="btn-ghost" style={{ padding: "10px 18px" }} disabled={pending} onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button className="btn-primary" style={{ padding: "10px 22px" }} disabled={pending} onClick={save}>
                  {pending ? "Saving…" : "Save & notify"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

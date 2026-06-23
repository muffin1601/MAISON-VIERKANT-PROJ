"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus, type OrderStatus } from "./actions";
// Status array MUST come from the plain lib, not the "use server" actions module
// (non-async server-action exports aren't real values on the client in prod).
import { ADMIN_ASSIGNABLE_STATUSES, statusMeta } from "@/lib/orderStatus";
import { showToast } from "@/lib/toast";

const ORDER_STATUSES = ADMIN_ASSIGNABLE_STATUSES;

/** Inline admin control to change an order's status (emails the customer). */
export function OrderStatusSelect({
  number,
  status,
  canWrite,
}: {
  number: string;
  status: string;
  canWrite: boolean;
}) {
  const [value, setValue] = useState(String(status ?? "").toUpperCase());
  const [pending, startTransition] = useTransition();
  const meta = statusMeta(value);

  if (!canWrite) {
    return (
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
  }

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        const res = await updateOrderStatus({ number, status: next as OrderStatus });
        if (!res.ok) {
          setValue(prev);
          showToast("Order not found — it may have been removed.");
          return;
        }
        showToast(`Order ${number} → ${statusMeta(next).label}. Customer notified by email.`);
      } catch {
        setValue(prev);
        showToast("Could not update status.");
      }
    });
  }

  // If the order is in a payment-driven or legacy status not in the assignable set,
  // surface it as a selectable option too so it displays correctly.
  const options = ORDER_STATUSES.includes(value as OrderStatus)
    ? [...ORDER_STATUSES]
    : [value, ...ORDER_STATUSES];

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: `1px solid ${meta.color}`,
        color: meta.color,
        borderRadius: 20,
        padding: "4px 10px",
        fontSize: 11,
        background: "#fff",
      }}
      aria-label={`Status for order ${number}`}
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {statusMeta(s).label}
        </option>
      ))}
    </select>
  );
}

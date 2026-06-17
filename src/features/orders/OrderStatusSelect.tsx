"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus, ORDER_STATUSES, type OrderStatus } from "./actions";
import { showToast } from "@/lib/toast";

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
  const [value, setValue] = useState(status.toUpperCase());
  const [pending, startTransition] = useTransition();

  if (!canWrite) {
    return <span className={`sbadge s-${status.toLowerCase()}`}>{status}</span>;
  }

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await updateOrderStatus({ number, status: next as OrderStatus });
        showToast(`Order ${number} → ${next}. Customer notified by email.`);
      } catch {
        setValue(prev);
        showToast("Could not update status.");
      }
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className={`sbadge s-${value.toLowerCase()}`}
      style={{ border: "1px solid var(--cream3)", borderRadius: 4, padding: "4px 8px", fontSize: 11 }}
      aria-label={`Status for order ${number}`}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

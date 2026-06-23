"use client";

import { useQuery } from "@tanstack/react-query";
import { Ticket, Check, Copy } from "lucide-react";
import { useState } from "react";
import { showToast } from "@/lib/toast";

interface AvailableCoupon {
  code: string;
  description: string;
  label: string;
  minSubtotalInr: number;
  expiresAt: string | null;
}
interface UsedCoupon {
  code: string;
  description: string;
  amountInr: number;
  orderNumber: string | null;
  usedAt: string;
}

export function CouponsView() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["account", "coupons"],
    queryFn: async () => {
      const res = await fetch("/api/account/coupons");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed");
      return json.data as { available: AvailableCoupon[]; used: UsedCoupon[] };
    },
  });
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      showToast(`Copied ${code}`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      showToast("Could not copy.");
    }
  };

  if (isLoading)
    return (
      <div className="addr-grid" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="addr-card skeleton-card" />
        ))}
      </div>
    );
  if (isError)
    return (
      <div className="addr-empty">
        <p>Couldn&apos;t load coupons.</p>
        <button className="btn-ghost" onClick={() => refetch()} style={{ marginTop: 8 }}>
          Try again
        </button>
      </div>
    );

  const available = data?.available ?? [];
  const used = data?.used ?? [];

  return (
    <div>
      <div className="co-section-title">Available coupons</div>
      {available.length === 0 ? (
        <div className="addr-empty" style={{ textAlign: "center" }}>
          <Ticket size={26} style={{ color: "var(--gold)" }} aria-hidden />
          <p style={{ marginTop: 8 }}>No coupons available right now.</p>
        </div>
      ) : (
        <div className="cpn-grid">
          {available.map((c) => (
            <div key={c.code} className="cpn-card">
              <div className="cpn-left">
                <div className="cpn-label">{c.label}</div>
                {c.description && <div className="cpn-desc">{c.description}</div>}
                {c.minSubtotalInr > 0 && (
                  <div className="cpn-min">Min order ₹{c.minSubtotalInr.toLocaleString("en-IN")}</div>
                )}
                {c.expiresAt && (
                  <div className="cpn-min">
                    Expires {new Date(c.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                )}
              </div>
              <button className="cpn-code" onClick={() => copy(c.code)} aria-label={`Copy code ${c.code}`}>
                {c.code} {copied === c.code ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {used.length > 0 && (
        <>
          <div className="co-section-title" style={{ marginTop: 28 }}>
            Used coupons
          </div>
          <div className="cpn-grid">
            {used.map((u, i) => (
              <div key={i} className="cpn-card cpn-used">
                <div className="cpn-left">
                  <div className="cpn-label">{u.code}</div>
                  <div className="cpn-desc">
                    Saved ₹{u.amountInr.toLocaleString("en-IN")}
                    {u.orderNumber ? ` · ${u.orderNumber}` : ""}
                  </div>
                  <div className="cpn-min">
                    {new Date(u.usedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Lock } from "lucide-react";
import { useCart } from "@/store/cart";
import { useAddressBook } from "@/store/address";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import type { PriceMap } from "@/features/cart/CartView";
import type { PaymentSettings } from "@/services/settings/paymentSettings";
import { BankDetailsCard } from "@/features/checkout/BankDetailsCard";

const DRAFT_KEY = "mvi_checkout_draft";
type Errs = Partial<Record<keyof CoData, string>>;

const CO_STEPS = ["Your Details", "Review Order", "Payment"];
const DELHI_KEYS = [
  "delhi",
  "new delhi",
  "ncr",
  "noida",
  "gurgaon",
  "gurugram",
  "faridabad",
  "ghaziabad",
];
const isDelhiZone = (city: string, state: string) =>
  DELHI_KEYS.some((k) => city.toLowerCase().includes(k) || state.toLowerCase().includes(k));

interface CoData {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  gst?: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  state?: string;
  pin?: string;
  notes?: string;
}

/** 3-step checkout ending in OFFLINE payment instructions (no online gateway). */
export function CheckoutView({ priceMap, settings }: { priceMap: PriceMap; settings: PaymentSettings }) {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);

  const [step, setStep] = useState(1);
  const [data, setData] = useState<CoData>({});
  const [errors, setErrors] = useState<Errs>({});
  const addresses = useAddressBook((s) => s.addresses);
  const saveAddress = useAddressBook((s) => s.add);
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState("");
  const [placed, setPlaced] = useState<{
    num: string;
    name: string;
    email: string;
    advance: number;
  } | null>(null);

  const unitOf = (id: string, code: string) => priceMap[`${id}|${code}`]?.unit ?? 0;
  const total = items.reduce((s, i) => s + unitOf(i.id, i.code) * i.qty, 0);
  const advance = Math.round(total * 0.5);
  const delhi = isDelhiZone(data.city || "", data.state || "");

  const set = (patch: Partial<CoData>) => {
    setData((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      (Object.keys(patch) as (keyof CoData)[]).forEach((k) => delete next[k]);
      return next;
    });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {}
  }, [data]);

  function step1Next() {
    const e: Errs = {};
    if (!data.name?.trim()) e.name = "Please enter your full name.";
    if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) e.email = "Enter a valid email address.";
    if (!data.phone || data.phone.replace(/\D/g, "").length < 10)
      e.phone = "Enter a 10-digit phone number.";
    if (!data.addr1?.trim()) e.addr1 = "Enter your address.";
    if (!data.city?.trim()) e.city = "Enter your city.";
    if (!data.state?.trim()) e.state = "Enter your state.";
    if (!data.pin || data.pin.replace(/\D/g, "").length !== 6) e.pin = "Enter a 6-digit PIN code.";
    setErrors(e);
    if (Object.keys(e).length) {
      showToast("Please correct the highlighted fields.");
      return;
    }
    setStep(2);
  }

  function useSavedAddress(id: string) {
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    set({
      name: a.name,
      company: a.company,
      phone: a.phone,
      addr1: a.addr1,
      addr2: a.addr2,
      city: a.city,
      state: a.state,
      pin: a.pin,
      gst: a.gst,
    });
  }
  function saveCurrentAddress() {
    if (!data.name || !data.addr1 || !data.city || !data.state || !data.pin || !data.phone) {
      showToast("Complete the address fields before saving.");
      return;
    }
    saveAddress({
      label: data.city || "Address",
      name: data.name,
      company: data.company,
      phone: data.phone,
      addr1: data.addr1,
      addr2: data.addr2,
      city: data.city,
      state: data.state,
      pin: data.pin,
      gst: data.gst,
    });
    showToast("Address saved to your address book.");
  }

  // Stable per-session order number → retrying reuses the same order (idempotent).
  // High-entropy random suffix so order numbers can't be enumerated/guessed.
  const [orderNum] = useState(() => {
    const rand =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()
        : Math.random().toString(36).slice(2, 12).toUpperCase();
    return "MVI-ORD-" + rand;
  });

  async function placeOrder() {
    if (processing) return;
    setPayError("");
    setProcessing(true);
    try {
      const res = await fetch("/api/checkout/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: orderNum, customer: data, items }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Could not create your order. Please try again.");
      }
      const advanceInr = Number(json.data?.advanceInr ?? advance);
      setPlaced({ num: orderNum, name: data.name || "", email: data.email || "", advance: advanceInr });
      clear();
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      showToast(e instanceof Error ? e.message : "Order could not be placed.");
    } finally {
      setProcessing(false);
    }
  }

  const addrFull = [
    data.addr1,
    data.addr2,
    data.city && data.state ? `${data.city}, ${data.state}` : data.city || data.state,
    data.pin,
    "India",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div id="page-checkout" className="page active">
      <div className="sw" style={{ maxWidth: 960 }}>
        <h1 className="st" style={{ marginBottom: 7 }}>
          Complete Your <em>Order</em>
        </h1>

        {/* Step indicator */}
        <div className="steps-row" id="co-steps" style={{ marginBottom: 32 }}>
          {CO_STEPS.map((s, i) => {
            const n = i + 1;
            const state = step > n ? "done" : step === n ? "active" : "todo";
            return (
              <span key={s} style={{ display: "inline-flex", alignItems: "center" }}>
                <span className={`step-c ${state}`}>{step > n ? "✓" : n}</span>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: ".1em",
                    color: state === "active" ? "var(--ink)" : "var(--ink4)",
                    marginRight: 12,
                  }}
                >
                  {s}
                </span>
                {n < CO_STEPS.length && (
                  <span style={{ color: "var(--cream3)", fontSize: 14, marginRight: 12 }}>›</span>
                )}
              </span>
            );
          })}
        </div>

        {placed ? (
          <div
            className="co-success"
            style={{ maxWidth: 600, margin: "0 auto", padding: "20px 20px 16px" }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                aria-hidden
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  margin: "0 auto 22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--cream2)",
                  border: "1.5px solid var(--gold)",
                }}
              >
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 30,
                  fontWeight: 300,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                Order Placed
              </div>
              <div style={{ fontSize: 13, color: "var(--ink4)", marginBottom: 6 }}>
                Order No: <strong style={{ color: "var(--gold)" }}>{placed.num}</strong>
              </div>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--ink3)",
                  lineHeight: 1.9,
                  maxWidth: 500,
                  margin: "16px auto",
                }}
              >
                Thank you, <strong>{placed.name}</strong>. Your order is reserved. To confirm it,
                please transfer the <strong>50% advance of {fmt(placed.advance)}</strong> using the
                details below, then upload your payment proof. We&apos;ve emailed these instructions
                to <strong>{placed.email}</strong>.
              </p>
            </div>

            <BankDetailsCard settings={settings} amount={placed.advance} reference={placed.num} />

            <div style={{ textAlign: "center", marginTop: 22 }}>
              <Link
                className="btn-primary"
                href="/account/orders"
                style={{ padding: "13px 32px", marginRight: 10 }}
              >
                Upload Payment Proof →
              </Link>
              <Link className="btn-ghost" href="/" style={{ padding: "13px 28px" }}>
                Back to Collection
              </Link>
            </div>
            <p
              style={{
                fontSize: 11,
                color: "var(--ink4)",
                lineHeight: 1.8,
                maxWidth: 460,
                margin: "22px auto 0",
                textAlign: "center",
              }}
            >
              Use your order number as the payment reference. Once verified, production begins (lead
              time 10–14 weeks). Balance payable before dispatch from Ostend.
            </p>
          </div>
        ) : (
          <div className="co-grid">
            <div id="co-form">
              {step === 1 ? (
                <Step1
                  data={data}
                  set={set}
                  delhi={delhi}
                  onNext={step1Next}
                  errors={errors}
                  addresses={addresses}
                  onUseSaved={useSavedAddress}
                  onSaveAddress={saveCurrentAddress}
                />
              ) : step === 2 ? (
                <Step3
                  items={items}
                  priceMap={priceMap}
                  data={data}
                  delhi={delhi}
                  addrFull={addrFull}
                  onBack={() => setStep(1)}
                  onNext={() => setStep(3)}
                />
              ) : (
                <Step4
                  total={total}
                  settings={settings}
                  orderNum={orderNum}
                  notes={data.notes || ""}
                  setNotes={(v) => set({ notes: v })}
                  onBack={() => setStep(2)}
                  onPlace={placeOrder}
                  processing={processing}
                  payError={payError}
                />
              )}
            </div>

            {/* sticky summary */}
            <div>
              <div id="co-summary" style={{ position: "sticky", top: 24 }}>
                <div className="co-sum-box">
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: ".18em",
                      color: "var(--gold2)",
                      marginBottom: 12,
                    }}
                  >
                    ORDER SUMMARY
                  </div>
                  {items.map((i) => {
                    const info = priceMap[`${i.id}|${i.code}`];
                    return (
                      <div className="co-review-row" key={`${i.id}|${i.finish}|${i.code}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="co-review-img" src={info?.img || i.img} alt={i.name} />
                        <div className="co-review-info">
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{i.code || i.name}</div>
                          <div style={{ fontSize: 10, color: "var(--ink4)" }}>
                            {i.finish} · Qty {i.qty}
                          </div>
                        </div>
                        <div className="co-review-price">{fmt((info?.unit ?? 0) * i.qty)}</div>
                      </div>
                    );
                  })}
                  <div
                    style={{
                      borderTop: "1px solid rgba(248,245,240,.15)",
                      paddingTop: 12,
                      marginTop: 12,
                    }}
                  >
                    <div className="co-sum-line">
                      <span>Subtotal (incl. duty + GST)</span>
                      <span>{fmt(total)}</span>
                    </div>
                    <div className="co-sum-line" style={{ color: "rgba(212,185,120,.8)" }}>
                      <span>✓ Delhi delivery included</span>
                    </div>
                    <div className="co-sum-total">
                      <span>Total</span>
                      <span>{fmt(total)}</span>
                    </div>
                    <div className="co-sum-line" style={{ color: "rgba(212,185,120,.9)", marginTop: 6 }}>
                      <span>50% advance to confirm</span>
                      <span>{fmt(advance)}</span>
                    </div>
                  </div>
                </div>
                <div className="co-trust">
                  ✓ All prices ex-Delhi · Import duty &amp; GST included
                  <br />✓ Transport outside Delhi charged at actual
                  <br />✓ Handcrafted in Ostend, Belgium
                  <br />✓ 10–14 weeks · 50% advance · Offline payment
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  ...rest
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = rest.id || rest.name;
  return (
    <div className="co-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={error ? "error" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        {...rest}
      />
      {error && (
        <span id={`${id}-err`} className="co-field-err" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function Step1({
  data,
  set,
  delhi,
  onNext,
  errors,
  addresses,
  onUseSaved,
  onSaveAddress,
}: {
  data: CoData;
  set: (p: Partial<CoData>) => void;
  delhi: boolean;
  onNext: () => void;
  errors: Errs;
  addresses: ReturnType<typeof useAddressBook.getState>["addresses"];
  onUseSaved: (id: string) => void;
  onSaveAddress: () => void;
}) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      {addresses.length > 0 && (
        <div className="co-field">
          <label htmlFor="co-saved">Use a saved address</label>
          <select
            id="co-saved"
            defaultValue=""
            onChange={(e) => e.target.value && onUseSaved(e.target.value)}
          >
            <option value="">Enter a new address…</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} — {a.name}, {a.city}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="co-section-title">Contact Details</div>
      <div className="co-2col">
        <Field
          label="Full Name *"
          name="name"
          autoComplete="name"
          value={data.name || ""}
          placeholder="Your full name"
          error={errors.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <Field
          label="Company / Firm"
          name="company"
          autoComplete="organization"
          value={data.company || ""}
          placeholder="Optional"
          onChange={(e) => set({ company: e.target.value })}
        />
      </div>
      <div className="co-2col">
        <Field
          label="Email *"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={data.email || ""}
          placeholder="email@example.com"
          error={errors.email}
          onChange={(e) => set({ email: e.target.value })}
        />
        <div className="co-field">
          <label htmlFor="phone">Phone (India) *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <span
              style={{
                padding: "11px 12px",
                background: "var(--cream2)",
                border: "1px solid var(--cream3)",
                borderRadius: 3,
                fontSize: 13,
                color: "var(--ink3)",
              }}
            >
              +91
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel-national"
              inputMode="numeric"
              className={errors.phone ? "error" : undefined}
              aria-invalid={errors.phone ? true : undefined}
              value={data.phone || ""}
              placeholder="98100 00000"
              maxLength={10}
              style={{ flex: 1 }}
              onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          {errors.phone && (
            <span className="co-field-err" role="alert">
              {errors.phone}
            </span>
          )}
        </div>
      </div>
      <Field
        label="GST Number (optional)"
        name="gst"
        value={data.gst || ""}
        placeholder="For trade / business invoices"
        onChange={(e) => set({ gst: e.target.value })}
      />
      <div className="co-section-title">Delivery Address</div>
      <Field
        label="Address Line 1 *"
        name="addr1"
        autoComplete="address-line1"
        value={data.addr1 || ""}
        placeholder="Flat / House No., Building, Street"
        error={errors.addr1}
        onChange={(e) => set({ addr1: e.target.value })}
      />
      <Field
        label="Address Line 2"
        name="addr2"
        autoComplete="address-line2"
        value={data.addr2 || ""}
        placeholder="Area / Locality / Landmark"
        onChange={(e) => set({ addr2: e.target.value })}
      />
      <div className="co-3col">
        <Field
          label="City *"
          name="city"
          autoComplete="address-level2"
          value={data.city || ""}
          placeholder="e.g. New Delhi"
          error={errors.city}
          onChange={(e) => set({ city: e.target.value })}
        />
        <Field
          label="State *"
          name="state"
          autoComplete="address-level1"
          value={data.state || ""}
          placeholder="e.g. Delhi"
          error={errors.state}
          onChange={(e) => set({ state: e.target.value })}
        />
        <Field
          label="PIN Code *"
          name="pin"
          autoComplete="postal-code"
          inputMode="numeric"
          value={data.pin || ""}
          placeholder="110001"
          maxLength={6}
          error={errors.pin}
          onChange={(e) => set({ pin: e.target.value.replace(/\D/g, "") })}
        />
      </div>
      {!delhi && (data.city || data.state) && (
        <div className="co-transport-note" id="co-transport-note">
          <strong>📦 Delivery outside Delhi</strong>
          <br />
          Our prices are ex-Delhi. Transport charges for your location will be calculated at actual
          freight and shared before order confirmation.
        </div>
      )}
      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-primary" style={{ padding: "13px 32px" }}>
          Continue to Review →
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onSaveAddress}
          style={{ padding: "11px 20px" }}
        >
          Save address
        </button>
      </div>
    </form>
  );
}

function Step3({
  items,
  priceMap,
  data,
  delhi,
  addrFull,
  onBack,
  onNext,
}: {
  items: ReturnType<typeof useCart.getState>["items"];
  priceMap: PriceMap;
  data: CoData;
  delhi: boolean;
  addrFull: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="co-section-title">Order Items</div>
      {items.map((i) => {
        const info = priceMap[`${i.id}|${i.code}`];
        return (
          <div className="co-review-row" key={`${i.id}|${i.finish}|${i.code}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="co-review-img" src={info?.img || i.img} alt={i.name} />
            <div className="co-review-info">
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {i.name} — {i.code || i.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 2 }}>
                {i.finish} · {info?.dims || ""}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>
                {fmt(info?.unit ?? 0)} × {i.qty}
              </div>
            </div>
            <div className="co-review-price">{fmt((info?.unit ?? 0) * i.qty)}</div>
          </div>
        );
      })}
      <div className="co-section-title" style={{ marginTop: 20 }}>
        Delivery Details
      </div>
      <div
        style={{
          background: "var(--cream2)",
          borderRadius: 4,
          padding: "14px 16px",
          fontSize: 12,
          lineHeight: 2,
          color: "var(--ink3)",
        }}
      >
        <strong style={{ color: "var(--ink)" }}>{data.name}</strong>
        {data.company ? ` · ${data.company}` : ""}
        <br />+91 {data.phone} · {data.email}
        <br />
        {addrFull}
        {data.gst ? (
          <>
            <br />
            GSTIN: {data.gst}
          </>
        ) : null}
      </div>
      <div className="co-transport-note" style={{ marginTop: 16 }}>
        {delhi ? (
          <>
            <strong>✓ Delhi Delivery</strong>
            <br />
            Delivery to Delhi/NCR is included in the product price.
          </>
        ) : (
          <>
            <strong>📦 Transport — As Actual</strong>
            <br />
            You are ordering outside Delhi. Transport charges will be calculated at actual freight
            and shared within 24 hours of your enquiry.
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <button className="btn-ghost" onClick={onBack} style={{ padding: "11px 20px" }}>
          ← Back
        </button>
        <button className="btn-primary" onClick={onNext} style={{ padding: "13px 32px" }}>
          Continue to Payment →
        </button>
      </div>
    </>
  );
}

function Step4({
  total,
  settings,
  orderNum,
  notes,
  setNotes,
  onBack,
  onPlace,
  processing,
  payError,
}: {
  total: number;
  settings: PaymentSettings;
  orderNum: string;
  notes: string;
  setNotes: (v: string) => void;
  onBack: () => void;
  onPlace: () => void;
  processing: boolean;
  payError: string;
}) {
  const advance = Math.round(total * 0.5);
  return (
    <>
      <div className="co-section-title">Payment Method — Bank Transfer / UPI</div>
      <div className="co-transport-note" style={{ marginBottom: 16 }}>
        <strong>How offline payment works</strong>
        <br />
        1. Place your order — we reserve it instantly.
        <br />
        2. Transfer the 50% advance ({fmt(advance)}) to the account below.
        <br />
        3. Upload your payment proof from your account; we verify and begin production.
      </div>

      <BankDetailsCard settings={settings} amount={advance} reference={orderNum} />

      <div className="co-transport-note" style={{ marginTop: 16 }}>
        <strong>💳 Payment Terms</strong>
        <br />
        50% advance ({fmt(advance)}) secures your order with Atelier Vierkant Belgium
        <br />
        Balance {fmt(total - advance)} payable before dispatch from Ostend
      </div>
      <div className="co-field" style={{ marginTop: 4 }}>
        <label>Notes / Special Requirements</label>
        <textarea
          rows={2}
          placeholder="Special instructions, project name, installation notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{
            border: "1px solid var(--cream3)",
            borderRadius: 3,
            padding: 11,
            fontSize: 12,
            fontFamily: "'Jost', sans-serif",
            color: "var(--ink)",
            resize: "vertical",
          }}
        />
      </div>
      {payError && (
        <div
          role="alert"
          style={{
            background: "#fbeaea",
            border: "1px solid #e3b6b6",
            color: "var(--danger)",
            borderRadius: 3,
            padding: "10px 13px",
            fontSize: 12,
            lineHeight: 1.6,
            margin: "14px 0 4px",
          }}
        >
          {payError}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        <button
          className="btn-ghost"
          onClick={onBack}
          disabled={processing}
          style={{ padding: "11px 20px" }}
        >
          ← Back
        </button>
        <button
          className="btn-primary"
          onClick={onPlace}
          disabled={processing}
          style={{ padding: "13px 36px", opacity: processing ? 0.6 : 1 }}
        >
          {processing ? "Placing…" : "Place Order →"}
        </button>
      </div>
      <div className="co-secure">
        <span>
          <Lock size={13} aria-hidden /> Your details are encrypted
        </span>
        <span>
          <ShieldCheck size={13} aria-hidden /> Manually verified payments
        </span>
        <Link href="/returns">Returns &amp; cancellations</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </>
  );
}

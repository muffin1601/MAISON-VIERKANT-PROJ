"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/store/cart";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { loadRazorpay, type RazorpaySuccess } from "@/lib/razorpay-client";
import type { PriceMap } from "@/features/cart/CartView";

const CO_STEPS = ["Your Details", "Verify Phone", "Review Order", "Payment"];
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

/** Faithful port of the prototype 4-step checkout (renderCO + coRenderStep1..4 + placeOrder). */
export function CheckoutView({
  priceMap,
  codEnabled = true,
}: {
  priceMap: PriceMap;
  codEnabled?: boolean;
}) {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);

  const [step, setStep] = useState(1);
  const [data, setData] = useState<CoData>({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpField, setOtpField] = useState("");
  const [otpMsg, setOtpMsg] = useState("");
  const [verified, setVerified] = useState(false);
  const [pay, setPay] = useState<"razorpay" | "cod">("razorpay");
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState("");
  const [placed, setPlaced] = useState<{
    num: string;
    name: string;
    phone: string;
    email: string;
    method: "razorpay" | "cod";
  } | null>(null);

  const unitOf = (id: string, code: string) => priceMap[`${id}|${code}`]?.unit ?? 0;
  const total = items.reduce((s, i) => s + unitOf(i.id, i.code) * i.qty, 0);
  const delhi = isDelhiZone(data.city || "", data.state || "");

  const set = (patch: Partial<CoData>) => setData((d) => ({ ...d, ...patch }));

  function step1Next() {
    const errs: string[] = [];
    if (!data.name?.trim()) errs.push("Full name");
    if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) errs.push("Valid email");
    if (!data.phone || data.phone.trim().length < 10) errs.push("10-digit phone");
    if (!data.addr1?.trim()) errs.push("Address");
    if (!data.city?.trim()) errs.push("City");
    if (!data.state?.trim()) errs.push("State");
    if (!data.pin || data.pin.trim().length < 6) errs.push("PIN code");
    if (errs.length) {
      showToast("Please fill in: " + errs.join(", "));
      return;
    }
    setVerified(false);
    setOtpSent(false);
    setStep(2);
  }

  function sendOtp() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(code);
    setOtpSent(true);
    console.log("OTP (dev/demo):", code);
    showToast("OTP sent to +91 " + data.phone + " · (Demo: check browser console)");
  }

  function verifyOtp() {
    if (!otpField || otpField.length < 6) {
      setOtpMsg("Enter the 6-digit OTP");
      return;
    }
    if (otpField === otpCode) {
      setVerified(true);
      setStep(3);
    } else {
      setOtpMsg("Incorrect OTP. Please try again.");
      setOtpField("");
    }
  }

  // Stable per-session order number → retrying a failed payment reuses the same
  // order (server-side idempotency) instead of creating duplicates.
  const [orderNum] = useState(() => "MVI-ORD-" + Date.now().toString().slice(-6));

  function finish(method: "razorpay" | "cod") {
    setPlaced({
      num: orderNum,
      name: data.name || "",
      phone: data.phone || "",
      email: data.email || "",
      method,
    });
    clear();
  }

  async function placeOrder() {
    if (processing) return;
    setPayError("");
    setProcessing(true);
    try {
      const res = await fetch("/api/checkout/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: orderNum, customer: data, items, paymentMethod: pay }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Could not create your order. Please try again.");
      }
      const payment = json.data?.payment as
        | { provider: string; keyId?: string; gatewayOrderId?: string; amountInr: number }
        | null;

      // COD or mock provider (no live gateway in this env) → order already confirmed.
      if (!payment || payment.provider === "cod" || payment.provider === "mock") {
        finish(pay);
        return;
      }

      // Razorpay → open hosted checkout and verify server-side on success.
      if (payment.provider === "razorpay" && payment.keyId && payment.gatewayOrderId) {
        const ok = await loadRazorpay();
        if (!ok || !window.Razorpay) {
          throw new Error("Could not reach the payment gateway. Check your connection.");
        }
        const rzp = new window.Razorpay({
          key: payment.keyId,
          order_id: payment.gatewayOrderId,
          amount: Math.round(payment.amountInr * 100),
          currency: "INR",
          name: "Maison Vierkant India",
          description: `Order ${orderNum} · 50% advance`,
          prefill: { name: data.name, email: data.email, contact: data.phone },
          theme: { color: "#9a7a3a" },
          handler: async (resp: RazorpaySuccess) => {
            try {
              const v = await fetch("/api/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  gatewayOrderId: resp.razorpay_order_id,
                  gatewayPaymentId: resp.razorpay_payment_id,
                  signature: resp.razorpay_signature,
                }),
              });
              if (!v.ok) throw new Error();
              finish("razorpay");
            } catch {
              setPayError(
                "Payment received but confirmation is pending. Our team will verify and contact you shortly.",
              );
            } finally {
              setProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setProcessing(false);
              setPayError("Payment was not completed. You can try again.");
            },
          },
        });
        rzp.on("payment.failed", (r) => {
          setProcessing(false);
          setPayError(r?.error?.description || "Payment failed. Please try a different method.");
        });
        rzp.open();
        return; // success/failure handled in callbacks above
      }

      throw new Error("Unsupported payment response.");
    } catch (e) {
      // Any failure before the gateway modal opened → unblock so the user can retry.
      setProcessing(false);
      setPayError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      showToast(e instanceof Error ? e.message : "Payment could not be started.");
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

        <div className="co-grid">
          {/* form area */}
          <div id="co-form">
            {placed ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>
                  {placed.method === "cod" ? "📦" : "✅"}
                </div>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 28,
                    fontWeight: 300,
                    color: "var(--ink)",
                    marginBottom: 8,
                  }}
                >
                  {placed.method === "cod" ? "Order Confirmed" : "Payment Successful"}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink4)", marginBottom: 6 }}>
                  Order No: <strong style={{ color: "var(--gold)" }}>{placed.num}</strong>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--ink3)",
                    lineHeight: 1.9,
                    maxWidth: 460,
                    margin: "16px auto",
                  }}
                >
                  Thank you, <strong>{placed.name}</strong>.{" "}
                  {placed.method === "cod"
                    ? "Your order is confirmed. Our team will call you to arrange delivery and advance collection."
                    : "Your 50% advance has been received and your order is confirmed."}{" "}
                  A confirmation will be sent to <strong>+91 {placed.phone}</strong> and{" "}
                  <strong>{placed.email}</strong>.
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--ink4)",
                    lineHeight: 1.8,
                    maxWidth: 420,
                    margin: "0 auto 24px",
                  }}
                >
                  All prices are ex-Delhi inclusive of import duty and GST. Transport outside Delhi
                  will be confirmed separately. Lead time: 10–14 weeks. Handcrafted in Ostend,
                  Belgium.
                </p>
                <Link className="btn-primary" href="/" style={{ padding: "13px 32px" }}>
                  Back to Collection
                </Link>
              </div>
            ) : step === 1 ? (
              <Step1 data={data} set={set} delhi={delhi} onNext={step1Next} />
            ) : step === 2 ? (
              <Step2
                phone={data.phone || ""}
                verified={verified}
                otpSent={otpSent}
                otpField={otpField}
                otpMsg={otpMsg}
                setOtpField={setOtpField}
                onSend={sendOtp}
                onVerify={verifyOtp}
                onContinue={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            ) : step === 3 ? (
              <Step3
                items={items}
                priceMap={priceMap}
                data={data}
                delhi={delhi}
                addrFull={addrFull}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            ) : (
              <Step4
                total={total}
                pay={pay}
                setPay={setPay}
                notes={data.notes || ""}
                setNotes={(v) => set({ notes: v })}
                onBack={() => setStep(3)}
                onPlace={placeOrder}
                processing={processing}
                payError={payError}
                codEnabled={codEnabled}
              />
            )}
          </div>

          {/* sticky summary */}
          <div>
            <div id="co-summary" style={{ position: "sticky", top: 24 }}>
              {!placed && (
                <>
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
                          <img
                            className="co-review-img"
                            src={info?.img || i.img}
                            alt={i.name}
                          />
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
                    </div>
                  </div>
                  <div className="co-trust">
                    ✓ All prices ex-Delhi · Import duty &amp; GST included
                    <br />✓ Transport outside Delhi charged at actual
                    <br />✓ Handcrafted in Ostend, Belgium
                    <br />✓ 10–14 weeks · 50% advance
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="co-field">
      <label>{label}</label>
      <input {...rest} />
    </div>
  );
}

function Step1({
  data,
  set,
  delhi,
  onNext,
}: {
  data: CoData;
  set: (p: Partial<CoData>) => void;
  delhi: boolean;
  onNext: () => void;
}) {
  return (
    <>
      <div className="co-section-title">Personal Details</div>
      <div className="co-2col">
        <Field
          label="Full Name *"
          value={data.name || ""}
          placeholder="Your full name"
          onChange={(e) => set({ name: e.target.value })}
        />
        <Field
          label="Company / Firm"
          value={data.company || ""}
          placeholder="Optional"
          onChange={(e) => set({ company: e.target.value })}
        />
      </div>
      <div className="co-2col">
        <Field
          label="Email *"
          type="email"
          value={data.email || ""}
          placeholder="email@example.com"
          onChange={(e) => set({ email: e.target.value })}
        />
        <div className="co-field">
          <label>Phone (India) *</label>
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
              type="tel"
              value={data.phone || ""}
              placeholder="98100 00000"
              maxLength={10}
              style={{ flex: 1 }}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </div>
        </div>
      </div>
      <Field
        label="GST Number (optional)"
        value={data.gst || ""}
        placeholder="07XXXXX0000X1Z0"
        onChange={(e) => set({ gst: e.target.value })}
      />
      <div className="co-section-title">Delivery Address</div>
      <Field
        label="Address Line 1 *"
        value={data.addr1 || ""}
        placeholder="Flat / House No., Building, Street"
        onChange={(e) => set({ addr1: e.target.value })}
      />
      <Field
        label="Address Line 2"
        value={data.addr2 || ""}
        placeholder="Area / Locality / Landmark"
        onChange={(e) => set({ addr2: e.target.value })}
      />
      <div className="co-3col">
        <Field
          label="City *"
          value={data.city || ""}
          placeholder="e.g. New Delhi"
          onChange={(e) => set({ city: e.target.value })}
        />
        <Field
          label="State *"
          value={data.state || ""}
          placeholder="e.g. Delhi"
          onChange={(e) => set({ state: e.target.value })}
        />
        <Field
          label="PIN Code *"
          value={data.pin || ""}
          placeholder="110001"
          maxLength={6}
          onChange={(e) => set({ pin: e.target.value })}
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
      <div style={{ marginTop: 8 }}>
        <button className="btn-primary" onClick={onNext} style={{ padding: "13px 32px" }}>
          Continue to Verify Phone →
        </button>
      </div>
    </>
  );
}

function Step2(props: {
  phone: string;
  verified: boolean;
  otpSent: boolean;
  otpField: string;
  otpMsg: string;
  setOtpField: (v: string) => void;
  onSend: () => void;
  onVerify: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  if (props.verified) {
    return (
      <>
        <div className="co-verified">✅ Phone +91 {props.phone} verified</div>
        <button className="btn-primary" onClick={props.onContinue} style={{ padding: "13px 32px" }}>
          Continue to Review →
        </button>
      </>
    );
  }
  return (
    <>
      <div className="co-section-title">Verify Your Phone Number</div>
      <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 20, lineHeight: 1.7 }}>
        We&apos;ll send a 6-digit OTP to <strong>+91 {props.phone}</strong>
      </p>
      {!props.otpSent ? (
        <button className="btn-primary" onClick={props.onSend} style={{ padding: "13px 28px" }}>
          Send OTP to +91 {props.phone}
        </button>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "var(--ink4)", marginBottom: 16 }}>
            OTP sent to +91 {props.phone}. Check your SMS.
          </p>
          <div className="co-otp-wrap">
            <input
              className="co-otp-input"
              maxLength={6}
              placeholder="— — — — — —"
              value={props.otpField}
              onChange={(e) => props.setOtpField(e.target.value)}
            />
            <button className="co-verify-btn" onClick={props.onVerify}>
              Verify
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 14 }}>{props.otpMsg}</div>
          <button
            style={{
              background: "none",
              border: "none",
              color: "var(--gold)",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "'Jost', sans-serif",
              textDecoration: "underline",
            }}
            onClick={props.onSend}
          >
            Resend OTP
          </button>
        </>
      )}
      <div style={{ marginTop: 24 }}>
        <button className="btn-ghost" onClick={props.onBack} style={{ padding: "10px 20px" }}>
          ← Back
        </button>
      </div>
    </>
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
          Confirm &amp; Pay →
        </button>
      </div>
    </>
  );
}

function Step4({
  total,
  pay,
  setPay,
  notes,
  setNotes,
  onBack,
  onPlace,
  processing,
  payError,
  codEnabled,
}: {
  total: number;
  pay: "razorpay" | "cod";
  setPay: (v: "razorpay" | "cod") => void;
  notes: string;
  setNotes: (v: string) => void;
  onBack: () => void;
  onPlace: () => void;
  processing: boolean;
  payError: string;
  codEnabled: boolean;
}) {
  const advance = Math.round(total * 0.5);
  const opts: { v: "razorpay" | "cod"; label: string; sub: string }[] = [
    {
      v: "razorpay",
      label: "💳 Pay Securely Online",
      sub: "UPI · Cards · Net Banking · Wallets",
    },
    ...(codEnabled
      ? [{ v: "cod" as const, label: "📦 Cash on Delivery", sub: "Advance collected on delivery" }]
      : []),
  ];
  return (
    <>
      <div className="co-section-title">Select Payment Method</div>
      <div style={{ marginBottom: 18 }}>
        {opts.map((o) => (
          <label key={o.v} className={`pay-opt${pay === o.v ? " active" : ""}`}>
            <input
              type="radio"
              name="pay"
              value={o.v}
              checked={pay === o.v}
              onChange={() => setPay(o.v)}
              disabled={processing}
            />
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 13 }}>{o.label}</span>
              <span style={{ fontSize: 10, color: "var(--ink4)" }}>{o.sub}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="co-transport-note">
        <strong>💳 Payment Terms</strong>
        <br />
        50% advance ({fmt(advance)}) secures your order with Atelier Vierkant Belgium
        <br />
        Balance {fmt(total - advance)} payable before dispatch from Ostend
        <br />
        {pay === "razorpay"
          ? "You will be charged the 50% advance now via our secure payment gateway."
          : "Our team will arrange advance collection on delivery."}
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
          {processing
            ? "Processing…"
            : pay === "cod"
              ? "Place Order →"
              : `Pay ${fmt(advance)} Advance →`}
        </button>
      </div>
    </>
  );
}

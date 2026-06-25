"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, CreditCard, Landmark, Check } from "lucide-react";
import { useCart } from "@/store/cart";
import { useAddressBook } from "@/store/address";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import type { PriceMap } from "@/features/cart/CartView";
import type { PaymentSettings } from "@/services/settings/paymentSettings";
import { BankDetailsCard } from "@/features/checkout/BankDetailsCard";
import { RazorpayPayButton, type PaidInfo } from "@/features/checkout/RazorpayCheckout";
import {
  createCheckoutSession,
  placeBankOrder,
  type CheckoutSessionData,
} from "@/services/payment/paymentClient";

const DRAFT_KEY = "mvi_checkout_draft";
type Errs = Partial<Record<keyof CoData, string>>;
type Method = "RAZORPAY" | "BANK_TRANSFER";

const CO_STEPS = ["Your Details", "Review Order", "Payment"];
const DELHI_KEYS = ["delhi", "new delhi", "ncr", "noida", "gurgaon", "gurugram", "faridabad", "ghaziabad"];
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

interface PlacedState {
  method: Method;
  orderNumber: string;
  name: string;
  email: string;
  advance: number;
  full: boolean; // true when the customer paid 100% upfront
  paymentId?: string;
  amountPaid?: number;
}

/**
 * 3-step checkout: details → review → payment-method selection. A payment method
 * MUST be chosen before an order can be placed. Razorpay creates the order only
 * after a verified payment (via a draft checkout session); bank transfer creates a
 * PENDING_PAYMENT order immediately. All money is server-authoritative.
 */
export function CheckoutView({
  priceMap,
  settings,
  razorpayEnabled = false,
}: {
  priceMap: PriceMap;
  settings: PaymentSettings;
  razorpayEnabled?: boolean;
}) {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);

  const [step, setStep] = useState(1);
  const [data, setData] = useState<CoData>({});
  const [errors, setErrors] = useState<Errs>({});
  const addresses = useAddressBook((s) => s.addresses);
  const saveAddress = useAddressBook((s) => s.add);

  // Draft checkout session (server-computed totals). Created when the customer
  // reaches the payment step; recreated if they go back and edit.
  const [session, setSession] = useState<CheckoutSessionData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const [method, setMethod] = useState<Method | null>(null);
  const [bankPlacing, setBankPlacing] = useState(false);
  const [payError, setPayError] = useState("");
  const [placed, setPlaced] = useState<PlacedState | null>(null);

  // Coupon state. The applied code lives in a ref so the session-creation effect
  // (which doesn't depend on coupon state) always sends the latest code.
  const [couponInput, setCouponInput] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const couponRef = useRef<string | null>(null);
  const appliedCoupon = session?.discountInr && session.discountInr > 0 ? session.couponCode : null;

  // Pay-now amount choice: 50% advance (default) or 100% full. Kept in a ref so the
  // session-creation effect always reads the latest value.
  const [payFull, setPayFull] = useState(false);
  const payFullRef = useRef(false);

  const unitOf = (id: string, code: string) => priceMap[`${id}|${code}`]?.unit ?? 0;
  const clientTotal = items.reduce((s, i) => s + unitOf(i.id, i.code) * i.qty, 0);
  const total = session?.totalInr ?? clientTotal;
  const advance = session?.advanceInr ?? Math.round(clientTotal * 0.5);
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

  // Latest cart/customer, read inside the effect without re-triggering it on
  // every keystroke (notes etc.). Going back to an earlier step clears `session`,
  // which re-runs this with fresh data.
  const latest = useRef({ data, items });
  latest.current = { data, items };
  // Dedupe guard that survives React StrictMode's double-invoke in dev (a ref
  // persists across the immediate cleanup, so we never wedge a half-started fetch).
  const creating = useRef(false);

  // Create the server session when the customer reaches the payment step.
  useEffect(() => {
    if (step !== 3 || placed || session || creating.current) return;
    const { data: d, items: its } = latest.current;
    if (its.length === 0) return;
    creating.current = true;
    setSessionLoading(true);
    setSessionError("");
    createCheckoutSession(
      { ...d, name: d.name ?? "" },
      its.map((i) => ({ code: i.id, variantCode: i.code, finish: i.finish, qty: i.qty })),
      couponRef.current,
      payFullRef.current,
    )
      .then(setSession)
      .catch((e) => setSessionError(e instanceof Error ? e.message : "Could not start checkout."))
      .finally(() => {
        setSessionLoading(false);
        creating.current = false;
      });
  }, [step, placed, session]);

  // Switch the pay-now amount (50% / 100%) by re-creating the session server-side.
  async function selectPayFull(full: boolean) {
    if (payFullRef.current === full) return;
    payFullRef.current = full;
    setPayFull(full);
    setSessionLoading(true);
    const { data: d, items: its } = latest.current;
    try {
      const next = await createCheckoutSession(
        { ...d, name: d.name ?? "" },
        its.map((i) => ({ code: i.id, variantCode: i.code, finish: i.finish, qty: i.qty })),
        couponRef.current,
        full,
      );
      setSession(next);
    } catch {
      setSessionError("Could not update the amount. Please try again.");
    } finally {
      setSessionLoading(false);
    }
  }

  // Apply / remove a coupon by re-creating the session with the code. The server
  // re-validates and returns discounted totals (or ignores an invalid code).
  async function applyCoupon(remove = false) {
    const code = remove ? null : couponInput.trim().toUpperCase();
    setCouponBusy(true);
    setCouponMsg("");
    couponRef.current = code;
    const { data: d, items: its } = latest.current;
    try {
      const next = await createCheckoutSession(
        { ...d, name: d.name ?? "" },
        its.map((i) => ({ code: i.id, variantCode: i.code, finish: i.finish, qty: i.qty })),
        code,
        payFullRef.current,
      );
      setSession(next);
      if (!remove) {
        if (next.discountInr > 0) {
          setCouponMsg(`Applied — you saved ${fmt(next.discountInr)}.`);
        } else {
          couponRef.current = null;
          setCouponMsg("That code isn't valid for this order.");
        }
      } else {
        setCouponInput("");
      }
    } catch {
      setCouponMsg("Could not apply the coupon. Please try again.");
    } finally {
      setCouponBusy(false);
    }
  }

  function goToStep(n: number) {
    // Leaving the payment step invalidates the draft so totals are recomputed.
    if (step === 3 && n < 3) {
      setSession(null);
      setMethod(null);
      setPayError("");
    }
    setStep(n);
  }

  function step1Next() {
    const e: Errs = {};
    if (!data.name?.trim()) e.name = "Please enter your full name.";
    if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) e.email = "Enter a valid email address.";
    if (!data.phone || data.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit phone number.";
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
    set({ name: a.name, company: a.company, phone: a.phone, addr1: a.addr1, addr2: a.addr2, city: a.city, state: a.state, pin: a.pin, gst: a.gst });
  }
  function saveCurrentAddress() {
    if (!data.name || !data.addr1 || !data.city || !data.state || !data.pin || !data.phone) {
      showToast("Complete the address fields before saving.");
      return;
    }
    saveAddress({ label: data.city || "Address", name: data.name, company: data.company, phone: data.phone, addr1: data.addr1, addr2: data.addr2, city: data.city, state: data.state, pin: data.pin, gst: data.gst });
    showToast("Address saved to your address book.");
  }

  function onRazorpayPaid(info: PaidInfo) {
    setPlaced({
      method: "RAZORPAY",
      orderNumber: info.orderNumber || session?.orderNumber || "",
      name: data.name || "",
      email: data.email || "",
      advance,
      full: payFull,
      paymentId: info.paymentId,
      amountPaid: info.amountPaid,
    });
    clear();
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }

  async function placeBank() {
    if (bankPlacing || !session) return;
    setBankPlacing(true);
    setPayError("");
    try {
      const order = await placeBankOrder(session.token);
      setPlaced({ method: "BANK_TRANSFER", orderNumber: order.orderNumber, name: data.name || "", email: data.email || "", advance: order.advanceInr, full: payFull });
      clear();
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Could not place your order. Please try again.");
      showToast("Order could not be placed.");
    } finally {
      setBankPlacing(false);
    }
  }

  const addrFull = [data.addr1, data.addr2, data.city && data.state ? `${data.city}, ${data.state}` : data.city || data.state, data.pin, "India"].filter(Boolean).join(", ");

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
            const state = placed || step > n ? "done" : step === n ? "active" : "todo";
            return (
              <span key={s} style={{ display: "inline-flex", alignItems: "center" }}>
                <span className={`step-c ${state}`}>{placed || step > n ? "✓" : n}</span>
                <span style={{ fontSize: 10, letterSpacing: ".1em", color: state === "active" ? "var(--ink)" : "var(--ink4)", marginRight: 12 }}>{s}</span>
                {n < CO_STEPS.length && <span style={{ color: "var(--cream3)", fontSize: 14, marginRight: 12 }}>›</span>}
              </span>
            );
          })}
        </div>

        {placed ? (
          <SuccessScreen placed={placed} settings={settings} />
        ) : (
          <div className="co-grid">
            <div id="co-form">
              {step === 1 ? (
                <Step1 data={data} set={set} delhi={delhi} onNext={step1Next} errors={errors} addresses={addresses} onUseSaved={useSavedAddress} onSaveAddress={saveCurrentAddress} />
              ) : step === 2 ? (
                <ReviewStep items={items} priceMap={priceMap} data={data} delhi={delhi} addrFull={addrFull} onBack={() => goToStep(1)} onNext={() => setStep(3)} />
              ) : (
                <PaymentStep
                  session={session}
                  sessionLoading={sessionLoading}
                  sessionError={sessionError}
                  razorpayEnabled={razorpayEnabled}
                  settings={settings}
                  method={method}
                  setMethod={setMethod}
                  advance={advance}
                  total={total}
                  payFull={payFull}
                  onSelectPayFull={selectPayFull}
                  notes={data.notes || ""}
                  setNotes={(v) => set({ notes: v })}
                  onBack={() => goToStep(2)}
                  onRazorpayPaid={onRazorpayPaid}
                  onPlaceBank={placeBank}
                  bankPlacing={bankPlacing}
                  payError={payError}
                />
              )}
            </div>

            {/* sticky summary */}
            <div>
              <div id="co-summary" style={{ position: "sticky", top: 24 }}>
                <div className="co-sum-box">
                  <div style={{ fontSize: 9, letterSpacing: ".18em", color: "var(--gold2)", marginBottom: 12 }}>ORDER SUMMARY</div>
                  {items.map((i) => {
                    const info = priceMap[`${i.id}|${i.code}`];
                    return (
                      <div className="co-review-row" key={`${i.id}|${i.finish}|${i.code}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="co-review-img" src={info?.img || i.img} alt={i.name} />
                        <div className="co-review-info">
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{i.code || i.name}</div>
                          <div style={{ fontSize: 10, color: "var(--ink4)" }}>{i.finish} · Qty {i.qty}</div>
                        </div>
                        <div className="co-review-price">{fmt((info?.unit ?? 0) * i.qty)}</div>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: "1px solid rgba(248,245,240,.15)", paddingTop: 12, marginTop: 12 }}>
                    <div className="co-sum-line"><span>Subtotal (incl. duty + GST)</span><span>{fmt(total + (session?.discountInr ?? 0))}</span></div>
                    {session?.discountInr ? (
                      <div className="co-sum-line" style={{ color: "#7bd88f" }}>
                        <span>Coupon {appliedCoupon ? `(${appliedCoupon})` : ""}</span>
                        <span>−{fmt(session.discountInr)}</span>
                      </div>
                    ) : null}
                    <div className="co-sum-line" style={{ color: "rgba(212,185,120,.8)" }}><span>✓ Delhi delivery included</span></div>
                    <div className="co-sum-total"><span>Total</span><span>{fmt(total)}</span></div>
                    <div className="co-sum-line" style={{ color: "rgba(212,185,120,.9)", marginTop: 6 }}><span>{payFull ? "Paying now (full)" : "50% advance to confirm"}</span><span>{fmt(advance)}</span></div>
                    {!payFull && <div className="co-sum-line" style={{ fontSize: 11, opacity: 0.7 }}><span>Balance before dispatch</span><span>{fmt(total - advance)}</span></div>}

                    {/* Coupon */}
                    {appliedCoupon ? (
                      <div className="co-coupon-applied">
                        <span>✓ {appliedCoupon} applied</span>
                        <button type="button" className="ci-link" style={{ color: "#f8c" }} disabled={couponBusy} onClick={() => applyCoupon(true)}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="co-coupon">
                        <input
                          value={couponInput}
                          placeholder="Coupon code"
                          aria-label="Coupon code"
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === "Enter" && couponInput.trim() && applyCoupon()}
                        />
                        <button type="button" className="btn-gold-outline" style={{ padding: "9px 16px", fontSize: 12 }} disabled={couponBusy || !couponInput.trim()} onClick={() => applyCoupon()}>
                          {couponBusy ? "…" : "Apply"}
                        </button>
                      </div>
                    )}
                    {couponMsg && (
                      <div style={{ fontSize: 11, marginTop: 6, color: session?.discountInr ? "#7bd88f" : "#f3a" }}>{couponMsg}</div>
                    )}
                  </div>
                </div>
                <div className="co-trust">
                  ✓ All prices ex-Delhi · Import duty &amp; GST included
                  <br />✓ Transport outside Delhi charged at actual
                  <br />✓ Handcrafted in Ostend, Belgium
                  <br />✓ 10–14 weeks · 50% advance
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, ...rest }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = rest.id || rest.name;
  return (
    <div className="co-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={error ? "error" : undefined} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
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
    <form noValidate onSubmit={(e) => { e.preventDefault(); onNext(); }}>
      {addresses.length > 0 && (
        <div className="co-field">
          <label htmlFor="co-saved">Use a saved address</label>
          <select id="co-saved" defaultValue="" onChange={(e) => e.target.value && onUseSaved(e.target.value)}>
            <option value="">Enter a new address…</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>{a.label} — {a.name}, {a.city}</option>
            ))}
          </select>
        </div>
      )}
      <div className="co-section-title">Contact Details</div>
      <div className="co-2col">
        <Field label="Full Name *" name="name" autoComplete="name" value={data.name || ""} placeholder="Your full name" error={errors.name} onChange={(e) => set({ name: e.target.value })} />
        <Field label="Company / Firm" name="company" autoComplete="organization" value={data.company || ""} placeholder="Optional" onChange={(e) => set({ company: e.target.value })} />
      </div>
      <div className="co-2col">
        <Field label="Email *" name="email" type="email" autoComplete="email" inputMode="email" value={data.email || ""} placeholder="email@example.com" error={errors.email} onChange={(e) => set({ email: e.target.value })} />
        <div className="co-field">
          <label htmlFor="phone">Phone (India) *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ padding: "11px 12px", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 2, fontSize: 13, color: "var(--ink3)" }}>+91</span>
            <input id="phone" name="phone" type="tel" autoComplete="tel-national" inputMode="numeric" className={errors.phone ? "error" : undefined} aria-invalid={errors.phone ? true : undefined} value={data.phone || ""} placeholder="98100 00000" maxLength={10} style={{ flex: 1 }} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "") })} />
          </div>
          {errors.phone && <span className="co-field-err" role="alert">{errors.phone}</span>}
        </div>
      </div>
      <Field label="GST Number (optional)" name="gst" value={data.gst || ""} placeholder="For trade / business invoices" onChange={(e) => set({ gst: e.target.value })} />
      <div className="co-section-title">Delivery Address</div>
      <Field label="Address Line 1 *" name="addr1" autoComplete="address-line1" value={data.addr1 || ""} placeholder="Flat / House No., Building, Street" error={errors.addr1} onChange={(e) => set({ addr1: e.target.value })} />
      <Field label="Address Line 2" name="addr2" autoComplete="address-line2" value={data.addr2 || ""} placeholder="Area / Locality / Landmark" onChange={(e) => set({ addr2: e.target.value })} />
      <div className="co-3col">
        <Field label="City *" name="city" autoComplete="address-level2" value={data.city || ""} placeholder="e.g. New Delhi" error={errors.city} onChange={(e) => set({ city: e.target.value })} />
        <Field label="State *" name="state" autoComplete="address-level1" value={data.state || ""} placeholder="e.g. Delhi" error={errors.state} onChange={(e) => set({ state: e.target.value })} />
        <Field label="PIN Code *" name="pin" autoComplete="postal-code" inputMode="numeric" value={data.pin || ""} placeholder="110001" maxLength={6} error={errors.pin} onChange={(e) => set({ pin: e.target.value.replace(/\D/g, "") })} />
      </div>
      {!delhi && (data.city || data.state) && (
        <div className="co-transport-note" id="co-transport-note">
          <strong>📦 Delivery outside Delhi</strong>
          <br />
          Our prices are ex-Delhi. Transport charges for your location will be calculated at actual freight and shared before order confirmation.
        </div>
      )}
      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-primary" style={{ padding: "13px 32px" }}>Continue to Review →</button>
        <button type="button" className="btn-ghost" onClick={onSaveAddress} style={{ padding: "11px 20px" }}>Save address</button>
      </div>
    </form>
  );
}

function ReviewStep({
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
              <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name} — {i.code || i.name}</div>
              <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 2 }}>{i.finish} · {info?.dims || ""}</div>
              <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>{fmt(info?.unit ?? 0)} × {i.qty}</div>
            </div>
            <div className="co-review-price">{fmt((info?.unit ?? 0) * i.qty)}</div>
          </div>
        );
      })}
      <div className="co-section-title" style={{ marginTop: 20 }}>Delivery Details</div>
      <div style={{ background: "var(--cream2)", borderRadius: 2, padding: "14px 16px", fontSize: 12, lineHeight: 2, color: "var(--ink3)" }}>
        <strong style={{ color: "var(--ink)" }}>{data.name}</strong>
        {data.company ? ` · ${data.company}` : ""}
        <br />+91 {data.phone} · {data.email}
        <br />
        {addrFull}
        {data.gst ? (<><br />GSTIN: {data.gst}</>) : null}
      </div>
      <div className="co-transport-note" style={{ marginTop: 16 }}>
        {delhi ? (<><strong>✓ Delhi Delivery</strong><br />Delivery to Delhi/NCR is included in the product price.</>) : (<><strong>📦 Transport — As Actual</strong><br />You are ordering outside Delhi. Transport charges will be calculated at actual freight and shared within 24 hours of your enquiry.</>)}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <button className="btn-ghost" onClick={onBack} style={{ padding: "11px 20px" }}>← Back</button>
        <button className="btn-primary" onClick={onNext} style={{ padding: "13px 32px" }}>Continue to Payment →</button>
      </div>
    </>
  );
}

/** Step 3 — mandatory payment method selection + the matching place-order action. */
function PaymentStep({
  session,
  sessionLoading,
  sessionError,
  razorpayEnabled,
  settings,
  method,
  setMethod,
  advance,
  total,
  payFull,
  onSelectPayFull,
  notes,
  setNotes,
  onBack,
  onRazorpayPaid,
  onPlaceBank,
  bankPlacing,
  payError,
}: {
  session: CheckoutSessionData | null;
  sessionLoading: boolean;
  sessionError: string;
  razorpayEnabled: boolean;
  settings: PaymentSettings;
  method: Method | null;
  setMethod: (m: Method) => void;
  advance: number;
  total: number;
  payFull: boolean;
  onSelectPayFull: (full: boolean) => void;
  notes: string;
  setNotes: (v: string) => void;
  onBack: () => void;
  onRazorpayPaid: (info: PaidInfo) => void;
  onPlaceBank: () => void;
  bankPlacing: boolean;
  payError: string;
}) {
  const ready = !!session && !sessionLoading;
  const half = Math.round(total * 0.5);

  return (
    <>
      {/* How much to pay now */}
      <div className="co-section-title">How Much To Pay Now</div>
      <div className="pay-amount" role="radiogroup" aria-label="Amount to pay now">
        <button
          type="button"
          role="radio"
          aria-checked={!payFull}
          className={`pay-amount-opt${!payFull ? " selected" : ""}`}
          onClick={() => onSelectPayFull(false)}
          disabled={sessionLoading}
        >
          <span className="pay-amount-title">50% Advance</span>
          <span className="pay-amount-val">{fmt(half)}</span>
          <span className="pay-amount-sub">Balance {fmt(total - half)} before dispatch</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={payFull}
          className={`pay-amount-opt${payFull ? " selected" : ""}`}
          onClick={() => onSelectPayFull(true)}
          disabled={sessionLoading}
        >
          <span className="pay-amount-title">Pay Full Amount</span>
          <span className="pay-amount-val">{fmt(total)}</span>
          <span className="pay-amount-sub">Nothing due later</span>
        </button>
      </div>

      <div className="co-section-title" style={{ marginTop: 22 }}>Select a Payment Method</div>

      {sessionError && (
        <div role="alert" className="co-transport-note" style={{ borderColor: "#e3b6b6", background: "#fbeaea", color: "var(--danger)" }}>
          {sessionError} Please go back and try again.
        </div>
      )}

      <div className="pay-methods" role="radiogroup" aria-label="Payment method">
        {razorpayEnabled && (
          <PaymentCard
            selected={method === "RAZORPAY"}
            onSelect={() => setMethod("RAZORPAY")}
            icon={<CreditCard size={20} aria-hidden />}
            title="Pay Online"
            badge="Recommended"
            desc="UPI · Credit / Debit Card · Net Banking · Wallets — instant confirmation, secured by Razorpay."
          />
        )}
        <PaymentCard
          selected={method === "BANK_TRANSFER"}
          onSelect={() => setMethod("BANK_TRANSFER")}
          icon={<Landmark size={20} aria-hidden />}
          title="Bank Transfer / UPI"
          desc="Pay by NEFT / RTGS / UPI and upload proof. Your order will remain pending until payment is verified."
        />
      </div>

      {/* Notes */}
      <div className="co-field" style={{ marginTop: 18 }}>
        <label htmlFor="co-notes">Notes / Special Requirements</label>
        <textarea id="co-notes" rows={2} placeholder="Special instructions, project name, installation notes…" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ border: "1px solid var(--cream3)", borderRadius: 2, padding: 11, fontSize: 12, fontFamily: "'Jost', sans-serif", color: "var(--ink)", resize: "vertical" }} />
      </div>

      {/* Method-specific panel */}
      {method === "BANK_TRANSFER" && (
        <div style={{ marginTop: 16 }}>
          <BankDetailsCard settings={settings} amount={advance} reference={session?.orderNumber ?? ""} />
          <div className="co-transport-note" style={{ marginTop: 14 }}>
            <strong>💳 Payment Terms</strong>
            <br />
            {payFull
              ? `Full payment (${fmt(advance)}) — your order is fully paid, nothing due later.`
              : `50% advance (${fmt(advance)}) secures your order. Balance ${fmt(total - advance)} payable before dispatch.`}
          </div>
        </div>
      )}

      {payError && (
        <div role="alert" style={{ background: "#fbeaea", border: "1px solid #e3b6b6", color: "var(--danger)", borderRadius: 2, padding: "10px 13px", fontSize: 12, lineHeight: 1.6, margin: "14px 0 4px" }}>
          {payError}
        </div>
      )}

      {/* Validation hint when nothing is chosen */}
      {!method && (
        <p role="status" style={{ marginTop: 16, fontSize: 12, color: "var(--ink4)" }}>
          Please select a payment method to continue.
        </p>
      )}

      {/* Actions */}
      <div style={{ marginTop: 16 }}>
        {method === "RAZORPAY" ? (
          <RazorpayPayButton sessionToken={session?.token ?? ""} advanceInr={advance} onPaid={onRazorpayPaid} disabled={!ready} />
        ) : (
          <button type="button" className="btn-primary" onClick={onPlaceBank} disabled={!method || !ready || bankPlacing} style={{ padding: "14px 32px", width: "100%", opacity: !method || !ready || bankPlacing ? 0.55 : 1 }}>
            {bankPlacing ? "Placing order…" : method === "BANK_TRANSFER" ? "Place Order →" : "Select a payment method"}
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={onBack} disabled={bankPlacing} style={{ padding: "11px 20px", marginTop: 10 }}>← Back to review</button>
      </div>

      <div className="co-secure">
        <span><Lock size={13} aria-hidden /> Your details are encrypted</span>
        <span><ShieldCheck size={13} aria-hidden /> {razorpayEnabled ? "Secured by Razorpay" : "Manually verified payments"}</span>
        <Link href="/returns">Returns &amp; cancellations</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </>
  );
}

/** Accessible, keyboard-operable payment option card (radio semantics). */
function PaymentCard({
  selected,
  onSelect,
  icon,
  title,
  desc,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`pay-card${selected ? " selected" : ""}`}
    >
      <span className="pay-card-check" aria-hidden>{selected && <Check size={14} />}</span>
      <span className="pay-card-icon" aria-hidden>{icon}</span>
      <span className="pay-card-body">
        <span className="pay-card-title">
          {title}
          {badge && <span className="pay-card-badge">{badge}</span>}
        </span>
        <span className="pay-card-desc">{desc}</span>
      </span>
    </button>
  );
}

/** Confirmation / thank-you screen, branched by the chosen method. */
function SuccessScreen({ placed, settings }: { placed: PlacedState; settings: PaymentSettings }) {
  const razorpay = placed.method === "RAZORPAY";
  return (
    <div className="co-success" style={{ maxWidth: 600, margin: "0 auto", padding: "20px 20px 16px" }}>
      <div style={{ textAlign: "center" }}>
        <div aria-hidden style={{ width: 76, height: 76, borderRadius: "50%", margin: "0 auto 22px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream2)", border: "1.5px solid var(--gold)" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 300, color: "var(--ink)", marginBottom: 8 }}>
          {razorpay ? "Payment Successful" : "Order Placed"}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink4)", marginBottom: 6 }}>
          Order No: <strong style={{ color: "var(--gold)" }}>{placed.orderNumber}</strong>
        </div>
      </div>

      {razorpay ? (
        <>
          <div className="co-sum-box" style={{ background: "var(--ink)", margin: "16px 0" }}>
            <div className="co-sum-line" style={{ color: "rgba(248,245,240,.75)" }}><span>Payment ID</span><span style={{ fontFamily: "monospace", fontSize: 11 }}>{placed.paymentId || "—"}</span></div>
            <div className="co-sum-line" style={{ color: "rgba(248,245,240,.75)" }}><span>{placed.full ? "Amount paid (full)" : "Amount paid (50% advance)"}</span><span>{fmt(placed.amountPaid ?? placed.advance)}</span></div>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.9, textAlign: "center", maxWidth: 500, margin: "0 auto 16px" }}>
            Thank you, <strong>{placed.name}</strong>. Your advance is received and production begins now (lead time 10–14 weeks). A confirmation &amp; invoice have been emailed to <strong>{placed.email}</strong>.
          </p>
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <Link className="btn-primary" href="/account/orders" style={{ padding: "13px 28px", marginRight: 10 }}>View order &amp; invoice →</Link>
            <Link className="btn-ghost" href="/collection" style={{ padding: "13px 26px" }}>Continue shopping</Link>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.9, textAlign: "center", maxWidth: 500, margin: "16px auto" }}>
            Thank you, <strong>{placed.name}</strong>. Your order is reserved. To confirm it, transfer the{" "}
            <strong>
              {placed.full ? "full amount of " : "50% advance of "}
              {fmt(placed.advance)}
            </strong>{" "}
            using the details below, then upload your payment proof. We&apos;ve emailed these instructions to <strong>{placed.email}</strong>.
          </p>
          <BankDetailsCard settings={settings} amount={placed.advance} reference={placed.orderNumber} />
          <div style={{ textAlign: "center", marginTop: 22 }}>
            <Link className="btn-primary" href="/account/orders" style={{ padding: "13px 32px", marginRight: 10 }}>Upload Payment Proof →</Link>
            <Link className="btn-ghost" href="/collection" style={{ padding: "13px 28px" }}>Continue shopping</Link>
          </div>
          <p style={{ fontSize: 11, color: "var(--ink4)", lineHeight: 1.8, maxWidth: 460, margin: "22px auto 0", textAlign: "center" }}>
            Use your order number as the payment reference. Questions? Email <a href="mailto:report@watcon.net" style={{ color: "var(--gold)" }}>report@watcon.net</a>. Once verified, production begins.
          </p>
        </>
      )}
    </div>
  );
}

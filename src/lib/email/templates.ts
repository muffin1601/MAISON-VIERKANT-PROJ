/**
 * Plain, dependency-free HTML email templates. Inline styles only (email clients
 * strip <style>/external CSS). Every template runs through `layout()` for a
 * consistent branded shell.
 */

const GOLD = "#9a7a3a";
const INK = "#2b2722";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ec;font-family:Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:28px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border:1px solid #e7e0d4;border-radius:6px;overflow:hidden;">
        <tr><td style="background:${INK};padding:22px 32px;">
          <div style="color:#f8f5f0;font-size:19px;letter-spacing:.04em;">Maison Vierkant <span style="color:${GOLD};font-style:italic;">India</span></div>
          <div style="color:#9c948a;font-size:11px;letter-spacing:.14em;margin-top:3px;">CURATED BY WATCON</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="font-size:21px;font-weight:400;margin:0 0 18px;color:${INK};">${esc(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 32px;background:#faf7f1;border-top:1px solid #eee5d6;color:#8c847a;font-size:11px;line-height:1.7;">
          Handcrafted in Ostend, Belgium · Lead time 10–14 weeks<br/>
          This is a transactional email from Maison Vierkant India.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;padding:12px 26px;border-radius:4px;font-size:14px;">${esc(label)}</a>`;
}

function p(text: string): string {
  return `<p style="font-size:14px;line-height:1.8;color:#4a443c;margin:0 0 16px;">${text}</p>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: "Welcome to Maison Vierkant India",
    html: layout(
      `Welcome, ${esc(name)}`,
      p("Your account has been created. You can now track your orders and check out faster.") +
        p("Thank you for choosing handcrafted Atelier Vierkant pieces."),
    ),
  };
}

export function passwordResetEmail(name: string, resetUrl: string): { subject: string; html: string } {
  return {
    subject: "Reset your password",
    html: layout(
      "Reset your password",
      p(`Hello ${esc(name || "there")}, we received a request to reset your password.`) +
        p("Click the button below to choose a new one. This link expires in 60 minutes.") +
        `<p style="margin:8px 0 22px;">${button(resetUrl, "Reset Password")}</p>` +
        p("If you didn’t request this, you can safely ignore this email."),
    ),
  };
}

export interface OrderEmailLine {
  name: string;
  code: string;
  finish: string;
  qty: number;
  lineInr: number;
}

function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function itemsTable(items: OrderEmailLine[]): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee5d6;font-size:13px;">${esc(i.name)} <span style="color:#8c847a;">${esc(i.code)} · ${esc(i.finish)} · ×${i.qty}</span></td>
         <td align="right" style="padding:8px 0;border-bottom:1px solid #eee5d6;font-size:13px;">${inr(i.lineInr)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">${rows}</table>`;
}

export function orderConfirmationEmail(opts: {
  name: string;
  number: string;
  items: OrderEmailLine[];
  totalInr: number;
  advanceInr: number;
  method: "razorpay" | "cod" | "mock";
  orderUrl?: string;
}): { subject: string; html: string } {
  const { name, number, items, totalInr, advanceInr, method, orderUrl } = opts;
  const paidLine =
    method === "cod"
      ? p(`Your order is confirmed. Our team will arrange delivery and collect the 50% advance (${inr(advanceInr)}) on delivery.`)
      : p(`Your 50% advance of <strong>${inr(advanceInr)}</strong> has been received and your order is confirmed.`);
  return {
    subject: `Order ${number} confirmed — Maison Vierkant India`,
    html: layout(
      "Order Confirmed",
      p(`Thank you, ${esc(name)}.`) +
        paidLine +
        `<p style="font-size:12px;color:#8c847a;margin:0 0 6px;">Order number</p>
         <p style="font-size:16px;color:${GOLD};margin:0 0 16px;font-weight:600;">${esc(number)}</p>` +
        itemsTable(items) +
        `<table role="presentation" width="100%"><tr><td style="font-size:14px;">Total (incl. duty + GST)</td><td align="right" style="font-size:14px;font-weight:600;">${inr(totalInr)}</td></tr>
          <tr><td style="font-size:13px;color:#8c847a;padding-top:4px;">50% advance</td><td align="right" style="font-size:13px;color:#8c847a;padding-top:4px;">${inr(advanceInr)}</td></tr></table>` +
        (orderUrl ? `<p style="margin:22px 0 0;">${button(orderUrl, "View Order")}</p>` : "") +
        p("<br/>All prices are ex-Delhi inclusive of import duty and GST. Transport outside Delhi is confirmed separately."),
    ),
  };
}

export function orderStatusEmail(opts: {
  name: string;
  number: string;
  status: string;
  trackingNumber?: string | null;
  orderUrl?: string;
}): { subject: string; html: string } {
  const { name, number, status, trackingNumber, orderUrl } = opts;
  const pretty = status.charAt(0) + status.slice(1).toLowerCase();
  return {
    subject: `Order ${number} — ${pretty}`,
    html: layout(
      `Order ${pretty}`,
      p(`Hello ${esc(name)}, the status of your order <strong>${esc(number)}</strong> is now <strong>${esc(pretty)}</strong>.`) +
        (trackingNumber ? p(`Tracking number: <strong>${esc(trackingNumber)}</strong>`) : "") +
        (orderUrl ? `<p style="margin:18px 0 0;">${button(orderUrl, "View Order")}</p>` : ""),
    ),
  };
}

export function adminNewLeadEmail(opts: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: string;
  type?: string | null;
}): { subject: string; html: string } {
  const { name, email, phone, company, source, type } = opts;
  const row = (k: string, v?: string | null) =>
    v ? `<tr><td style="padding:5px 12px 5px 0;font-size:13px;color:#8c847a;">${k}</td><td style="padding:5px 0;font-size:13px;">${esc(v)}</td></tr>` : "";
  return {
    subject: `New ${source.toLowerCase()} lead: ${name}`,
    html: layout(
      "New Lead",
      p("A new lead was captured on the storefront.") +
        `<table role="presentation">${row("Name", name)}${row("Email", email)}${row("Phone", phone)}${row("Company", company)}${row("Source", source)}${row("Type", type)}</table>`,
    ),
  };
}

export function adminNewOrderEmail(opts: {
  number: string;
  name: string;
  totalInr: number;
  method: string;
}): { subject: string; html: string } {
  const { number, name, totalInr, method } = opts;
  return {
    subject: `New order ${number} — ${inr(totalInr)}`,
    html: layout(
      "New Order Received",
      p(`Order <strong>${esc(number)}</strong> from <strong>${esc(name)}</strong>.`) +
        p(`Total: <strong>${inr(totalInr)}</strong> · Payment: ${esc(method)}`),
    ),
  };
}

// ---------------------------------------------------------------------------
// Offline-payment templates
// ---------------------------------------------------------------------------

export interface BankDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  swift: string;
  branch: string;
  upiId: string;
  instructions: string;
}

function bankBlock(b: BankDetails): string {
  const row = (k: string, v?: string | null) =>
    v
      ? `<tr><td style="padding:5px 14px 5px 0;font-size:12px;color:#8c847a;white-space:nowrap;">${k}</td><td style="padding:5px 0;font-size:13px;color:${INK};font-weight:600;">${esc(v)}</td></tr>`
      : "";
  return `<div style="background:#faf7f1;border:1px solid #eee5d6;border-radius:5px;padding:14px 16px;margin:6px 0 16px;">
    <table role="presentation">${row("Bank", b.bankName)}${row("Account Holder", b.accountHolder)}${row("Account No.", b.accountNumber)}${row("IFSC", b.ifsc)}${row("SWIFT", b.swift)}${row("Branch", b.branch)}${row("UPI ID", b.upiId)}</table>
  </div>`;
}

export function orderCreatedOfflineEmail(opts: {
  name: string;
  number: string;
  items: OrderEmailLine[];
  totalInr: number;
  advanceInr: number;
  bank: BankDetails;
  orderUrl?: string;
}): { subject: string; html: string } {
  const { name, number, items, totalInr, advanceInr, bank, orderUrl } = opts;
  return {
    subject: `Order ${number} received — payment instructions`,
    html: layout(
      "Order Received",
      p(`Thank you, ${esc(name)}. Your order has been placed and is reserved pending payment.`) +
        `<p style="font-size:12px;color:#8c847a;margin:0 0 4px;">Order number</p>
         <p style="font-size:16px;color:${GOLD};margin:0 0 16px;font-weight:600;">${esc(number)}</p>` +
        itemsTable(items) +
        `<table role="presentation" width="100%"><tr><td style="font-size:14px;">Order total</td><td align="right" style="font-size:14px;font-weight:600;">${inr(totalInr)}</td></tr>
          <tr><td style="font-size:14px;color:${GOLD};padding-top:4px;">Advance due now (50%)</td><td align="right" style="font-size:15px;color:${GOLD};font-weight:700;padding-top:4px;">${inr(advanceInr)}</td></tr></table>` +
        `<h2 style="font-size:15px;font-weight:600;margin:22px 0 6px;color:${INK};">How to pay</h2>` +
        bankBlock(bank) +
        p(`<strong>Use your order number ${esc(number)} as the payment reference.</strong> ${esc(bank.instructions || "")}`) +
        (orderUrl ? `<p style="margin:18px 0 0;">${button(orderUrl, "Submit Payment Proof")}</p>` : "") +
        p("<br/>Once we verify your payment, production begins. Lead time 10–14 weeks. Balance is payable before dispatch from Ostend."),
    ),
  };
}

export function adminPaymentSubmittedEmail(opts: {
  number: string;
  name: string;
  amountInr: number;
  method: string;
  transactionId: string;
}): { subject: string; html: string } {
  const { number, name, amountInr, method, transactionId } = opts;
  return {
    subject: `Payment submitted for ${number} — ${inr(amountInr)}`,
    html: layout(
      "Payment Awaiting Review",
      p(`<strong>${esc(name)}</strong> submitted a payment for order <strong>${esc(number)}</strong>.`) +
        p(
          `Amount: <strong>${inr(amountInr)}</strong> · Method: ${esc(method)} · Ref: ${esc(transactionId)}`,
        ) +
        p("Review the proof and approve or reject it in the Payments queue."),
    ),
  };
}

export function paymentApprovedEmail(opts: {
  name: string;
  number: string;
  amountInr: number;
  orderUrl?: string;
}): { subject: string; html: string } {
  const { name, number, amountInr, orderUrl } = opts;
  return {
    subject: `Payment verified for ${number}`,
    html: layout(
      "Payment Verified",
      p(`Good news, ${esc(name)} — we've verified your payment of <strong>${inr(amountInr)}</strong> for order <strong>${esc(number)}</strong>.`) +
        p("Your order now moves into production. We'll keep you updated at each stage.") +
        (orderUrl ? `<p style="margin:18px 0 0;">${button(orderUrl, "View Order")}</p>` : ""),
    ),
  };
}

export function paymentRejectedEmail(opts: {
  name: string;
  number: string;
  reason: string;
  orderUrl?: string;
}): { subject: string; html: string } {
  const { name, number, reason, orderUrl } = opts;
  return {
    subject: `Action needed: payment for ${number}`,
    html: layout(
      "Payment Could Not Be Verified",
      p(`Hello ${esc(name)}, we were unable to verify your payment for order <strong>${esc(number)}</strong>.`) +
        `<div style="background:#fbeaea;border:1px solid #e3b6b6;border-radius:5px;padding:12px 14px;margin:6px 0 16px;font-size:13px;color:#8b2c2c;">${esc(reason)}</div>` +
        p("Please re-submit your payment proof with the correct details. If you have questions, just reply to this email.") +
        (orderUrl ? `<p style="margin:18px 0 0;">${button(orderUrl, "Re-submit Payment")}</p>` : ""),
    ),
  };
}

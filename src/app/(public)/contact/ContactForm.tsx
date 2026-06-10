"use client";

import { useState } from "react";
import { showToast } from "@/lib/toast";

/** Faithful port of the prototype contact form (now persists a Lead server-side). */
export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    represent: "A homeowner",
    message: "",
  });

  async function submit() {
    setSubmitting(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "CONTACT" }),
      }).catch(() => {});
      showToast("Message sent. Our team will be in touch within 24 hours.");
      setForm({ name: "", email: "", phone: "", represent: "A homeowner", message: "" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div>
        <label className="form-label">Your Name</label>
        <input
          className="form-input"
          type="text"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">Email</label>
        <input
          className="form-input"
          type="email"
          placeholder="email@company.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">Phone</label>
        <input
          className="form-input"
          type="tel"
          placeholder="+91 98000 00000"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">I represent</label>
        <select
          className="form-input"
          value={form.represent}
          onChange={(e) => setForm({ ...form, represent: e.target.value })}
        >
          <option>A homeowner</option>
          <option>A landscape firm / architect</option>
          <option>A hotel / hospitality project</option>
          <option>A real estate developer</option>
          <option>Other</option>
        </select>
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <label className="form-label">Message</label>
        <textarea
          className="form-input"
          rows={5}
          placeholder="Tell us about your project or enquiry..."
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <button className="btn-dark" onClick={submit} disabled={submitting}>
          Send Enquiry →
        </button>
      </div>
    </div>
  );
}

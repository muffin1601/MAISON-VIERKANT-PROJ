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
    if (submitting) return;
    if (!form.name.trim()) {
      showToast("Please enter your name.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(form.email)) {
      showToast("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "CONTACT" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || "Could not send your message.");
      }
      showToast("Message sent. Our team will be in touch within 24 hours.");
      setForm({ name: "", email: "", phone: "", represent: "A homeowner", message: "" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="r-grid-2" style={{ gap: 12 }}>
      <div>
        <label className="form-label" htmlFor="ct-name">
          Your Name
        </label>
        <input
          id="ct-name"
          className="form-input"
          type="text"
          autoComplete="name"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label" htmlFor="ct-email">
          Email
        </label>
        <input
          id="ct-email"
          className="form-input"
          type="email"
          autoComplete="email"
          placeholder="email@company.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label" htmlFor="ct-phone">
          Phone
        </label>
        <input
          id="ct-phone"
          className="form-input"
          type="tel"
          autoComplete="tel"
          placeholder="+91 98000 00000"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label" htmlFor="ct-represent">
          I represent
        </label>
        <select
          id="ct-represent"
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
        <label className="form-label" htmlFor="ct-message">
          Message
        </label>
        <textarea
          id="ct-message"
          className="form-input"
          rows={5}
          placeholder="Tell us about your project or enquiry..."
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <button className="btn-dark" onClick={submit} disabled={submitting}>
          {submitting ? "Sending…" : "Send Enquiry →"}
        </button>
      </div>
    </div>
  );
}

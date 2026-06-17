"use client";

import { useState } from "react";
import { useUI } from "@/store/ui";
import { showToast } from "@/lib/toast";

/** Faithful port of the prototype #cat-modal + submitCatForm. */
export function CatalogueModal() {
  const open = useUI((s) => s.catOpen);
  const close = useUI((s) => s.closeCat);
  const [f, setF] = useState({ name: "", email: "", phone: "", type: "Homeowner", company: "" });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;
    if (!f.name.trim() || !/\S+@\S+\.\S+/.test(f.email)) {
      showToast("Please enter your name and a valid email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, source: "CATALOGUE" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || "Could not submit your request.");
      }
      close();
      showToast(`Thank you! We will send the catalogue to ${f.email} within 24 hours.`);
      setF({ name: "", email: "", phone: "", type: "Homeowner", company: "" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      id="cat-modal"
      className="modal-bg"
      style={{ display: open ? "flex" : "none" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-modal-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <button className="modal-close" onClick={close} aria-label="Close catalogue request">
          ×
        </button>
        <p className="modal-title" id="cat-modal-title">
          Download <em style={{ fontStyle: "italic", color: "var(--gold)" }}>Catalogue</em>
        </p>
        <p className="modal-sub">
          Request our 2025 Atelier Vierkant Inspiration Book &amp; Product Data Sheet. We will send
          the catalogue to your email within one business day.
        </p>
        <label className="form-label" htmlFor="cat-name">
          Full Name *
        </label>
        <input
          id="cat-name"
          className="form-input"
          placeholder="Your full name"
          type="text"
          autoComplete="name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <label className="form-label" htmlFor="cat-email">
          Email *
        </label>
        <input
          id="cat-email"
          className="form-input"
          placeholder="email@company.com"
          type="email"
          autoComplete="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <label className="form-label" htmlFor="cat-phone">
          Phone
        </label>
        <input
          id="cat-phone"
          className="form-input"
          placeholder="+91 98000 00000"
          type="tel"
          autoComplete="tel"
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
        />
        <label className="form-label" htmlFor="cat-type">
          I am a
        </label>
        <select
          id="cat-type"
          className="form-input"
          value={f.type}
          onChange={(e) => setF({ ...f, type: e.target.value })}
        >
          <option>Homeowner</option>
          <option>Landscape Architect / Designer</option>
          <option>Interior Designer</option>
          <option>Hospitality / Hotel</option>
          <option>Real Estate Developer</option>
          <option>Other</option>
        </select>
        <label className="form-label" htmlFor="cat-company">
          Company / Firm
        </label>
        <input
          id="cat-company"
          className="form-input"
          placeholder="Optional"
          type="text"
          autoComplete="organization"
          value={f.company}
          onChange={(e) => setF({ ...f, company: e.target.value })}
        />
        <button
          className="btn-dark"
          style={{ width: "100%", padding: 13, marginTop: 4 }}
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "Sending…" : "Request Catalogue →"}
        </button>
        <p style={{ fontSize: 11, color: "var(--ink4)", marginTop: 10, textAlign: "center" }}>
          We respect your privacy. Your details will not be shared.
        </p>
      </div>
    </div>
  );
}

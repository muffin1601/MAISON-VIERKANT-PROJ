"use client";

import { useState } from "react";
import { useUI } from "@/store/ui";
import { showToast } from "@/lib/toast";

/** Faithful port of the prototype #cat-modal + submitCatForm. */
export function CatalogueModal() {
  const open = useUI((s) => s.catOpen);
  const close = useUI((s) => s.closeCat);
  const [f, setF] = useState({ name: "", email: "", phone: "", type: "Homeowner", company: "" });

  async function submit() {
    if (!f.name.trim() || !f.email.trim()) {
      showToast("Please fill in your name and email");
      return;
    }
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, source: "CATALOGUE" }),
    }).catch(() => {});
    close();
    showToast(`Thank you! We will send the catalogue to ${f.email} within 24 hours.`);
    setF({ name: "", email: "", phone: "", type: "Homeowner", company: "" });
  }

  return (
    <div id="cat-modal" className="modal-bg" style={{ display: open ? "flex" : "none" }}>
      <div className="modal">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <p className="modal-title">
          Download <em style={{ fontStyle: "italic", color: "var(--gold)" }}>Catalogue</em>
        </p>
        <p className="modal-sub">
          Request our 2025 Atelier Vierkant Inspiration Book &amp; Product Data Sheet. We will send
          the catalogue to your email within one business day.
        </p>
        <label className="form-label">Full Name *</label>
        <input
          className="form-input"
          placeholder="Your full name"
          type="text"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <label className="form-label">Email *</label>
        <input
          className="form-input"
          placeholder="email@company.com"
          type="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <label className="form-label">Phone</label>
        <input
          className="form-input"
          placeholder="+91 98000 00000"
          type="tel"
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
        />
        <label className="form-label">I am a</label>
        <select
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
        <label className="form-label">Company / Firm</label>
        <input
          className="form-input"
          placeholder="Optional"
          type="text"
          value={f.company}
          onChange={(e) => setF({ ...f, company: e.target.value })}
        />
        <button
          className="btn-dark"
          style={{ width: "100%", padding: 13, marginTop: 4 }}
          onClick={submit}
        >
          Request Catalogue →
        </button>
        <p style={{ fontSize: 11, color: "var(--ink4)", marginTop: 10, textAlign: "center" }}>
          We respect your privacy. Your details will not be shared.
        </p>
      </div>
    </div>
  );
}

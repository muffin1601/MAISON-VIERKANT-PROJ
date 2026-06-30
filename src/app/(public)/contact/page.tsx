import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Maison Vierkant for Atelier Vierkant clay vessels in India — trade enquiries, custom pieces and project consultations.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div id="page-contact" className="page active">
      <div className="sw">
        <div style={{ marginBottom: 44 }}>
          <div className="ey">Get in Touch</div>
          <h1 className="st">
            Let&apos;s <em>Talk</em>
          </h1>
        </div>
        <div className="contact-grid">
          <div>
            <ContactForm />
          </div>
          <div style={{ paddingTop: 4 }}>
            <div className="ci-item">
              <div className="ci-label">New Delhi Showroom — Watcon International</div>
              <div className="ci-val">
                By Appointment
                <br />
                343, Sultanpur, MG Road, Pin-110030
                <br />
                Next to Pillar No. 28B · Beside CJ Living showroom
                <br />
                <a
                  className="f-map-link"
                  href="https://www.google.com/maps/search/?api=1&query=Watcon+International%2C+343+Sultanpur%2C+MG+Road%2C+110030"
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Google Maps →
                </a>
              </div>
            </div>
            <div className="ci-item">
              <div className="ci-label">Email</div>
              <div className="ci-val">maison@watcon.net</div>
            </div>
            <div className="ci-item">
              <div className="ci-label">Phone</div>
              <div className="ci-val">+91-7669469620</div>
            </div>
            <div className="ci-item">
              <div className="ci-label">Atelier Vierkant Belgium</div>
              <div className="ci-val">Nijverheidslaan 28 · 8400 Ostend</div>
            </div>
            <div className="ci-item" style={{ border: "none" }}>
              <div className="ci-label">Showroom Hours</div>
              <div className="ci-val">
                Monday–Saturday: 10am–6pm
                <br />
                Sunday: By appointment only
              </div>
            </div>
          </div>
        </div>

        {/* Embedded location map (no API key — standard Google Maps embed). */}
        <div className="contact-map">
          <iframe
            title="Watcon International — 343 Sultanpur, MG Road, New Delhi 110030"
            src="https://maps.google.com/maps?q=343%20Sultanpur%2C%20MG%20Road%2C%20New%20Delhi%20110030&z=16&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

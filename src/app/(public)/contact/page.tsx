import { ContactForm } from "./ContactForm";

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
              <div className="ci-label">New Delhi Showroom</div>
              <div className="ci-val">
                By Appointment
                <br />
                343 Sultanpur, MG Road
                <br />
                New Delhi 110030
              </div>
            </div>
            <div className="ci-item">
              <div className="ci-label">Email</div>
              <div className="ci-val">hello@maisonvierkant.in</div>
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
      </div>
    </div>
  );
}

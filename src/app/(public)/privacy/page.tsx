import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Maison Vierkant India collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="TODO — set on launch">
      {/* TODO: replace placeholder copy with reviewed legal text before launch. */}
      <p>
        This Privacy Policy explains how Maison Vierkant India (Watcon Pvt. Ltd.) collects,
        uses, and safeguards the information you share when you request our catalogue, place an
        order, or contact us.
      </p>
      <h2>Information we collect</h2>
      <p>
        Name, email, phone, company, shipping address, GST details (for trade orders), and order
        history. Payment is processed by our gateway partner; we do not store card details.
      </p>
      <h2>How we use it</h2>
      <p>
        To fulfil orders, coordinate freight, respond to enquiries, and — only with your consent —
        share occasional updates. We do not sell your data.
      </p>
      <h2>Contact</h2>
      <p>For privacy requests, contact us at the address listed in the footer.</p>
    </LegalPage>
  );
}

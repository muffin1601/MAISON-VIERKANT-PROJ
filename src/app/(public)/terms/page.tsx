import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms governing purchases from Maison Vierkant India.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      {/* TODO: replace placeholder copy with reviewed legal text before launch. */}
      <p>
        These terms govern your use of this website and any order placed with Maison Vierkant
        India. By placing an order you accept them.
      </p>
      <h2>Made-to-order pieces</h2>
      <p>
        Most vessels are handcrafted to order with a typical lead time of 16–20 weeks. Orders are
        confirmed on receipt of a 50% advance; the balance is due before dispatch.
      </p>
      <h2>Pricing &amp; freight</h2>
      <p>
        Prices are ex-Delhi and exclusive of GST. Packaging charges and GST (18%) are added at
        checkout and shown as separate line items. Freight outside the Delhi NCR zone is quoted
        separately and shared before order confirmation.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India, with jurisdiction in New Delhi.</p>
    </LegalPage>
  );
}

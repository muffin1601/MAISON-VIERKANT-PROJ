import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Shipping & Delivery",
  description: "Shipping, freight, and white-glove delivery across India.",
};

export default function ShippingPage() {
  return (
    <LegalPage title="Shipping & Delivery">
      {/* TODO: replace placeholder copy with reviewed legal text before launch. */}
      <p>
        We deliver handcrafted vessels across India with care appropriate to their value and
        fragility.
      </p>
      <h2>Delhi NCR</h2>
      <p>White-glove delivery within the Delhi NCR zone is included in the listed price.</p>
      <h2>Rest of India</h2>
      <p>
        Freight outside Delhi NCR is quoted separately based on destination PIN code, dimensions,
        and weight, and is shared for your approval before order confirmation.
      </p>
      <h2>Lead time</h2>
      <p>
        Made-to-order pieces typically ship 16–20 weeks after order confirmation; you will receive
        tracking details on dispatch.
      </p>
    </LegalPage>
  );
}

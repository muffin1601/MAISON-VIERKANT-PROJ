import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Returns & Cancellations",
  description: "Returns, cancellations, and refund policy for Maison Vierkant India.",
};

export default function ReturnsPage() {
  return (
    <LegalPage title="Returns & Cancellations">
      {/* TODO: replace placeholder copy with reviewed legal text before launch. */}
      <p>
        Because our pieces are handcrafted to order, our returns policy differs from mass-market
        retail. Please read carefully.
      </p>
      <h2>Cancellations</h2>
      <p>
        Orders may be cancelled within 48 hours of the advance payment for a full refund.
        Thereafter the advance is non-refundable as production will have begun.
      </p>
      <h2>Damage in transit</h2>
      <p>
        Inspect your delivery on arrival. Report any transit damage with photographs within 48
        hours and we will arrange repair or replacement at no cost.
      </p>
      <h2>Refund timeline</h2>
      <p>Approved refunds are processed to the original payment method within 7–10 business days.</p>
    </LegalPage>
  );
}

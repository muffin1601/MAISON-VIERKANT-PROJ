import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getPaymentSettings } from "@/services/settings/paymentSettings";
import { PaymentSettingsForm } from "@/features/payments/PaymentSettingsForm";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "settings.manage")) {
    return (
      <div className="a-page active">
        <div className="a-title">Payment Settings</div>
        <div className="a-sub">You do not have access to payment settings.</div>
      </div>
    );
  }

  const settings = await getPaymentSettings();

  return (
    <div className="a-page active">
      <div className="a-title">Payment Settings</div>
      <div className="a-sub">
        Bank &amp; UPI details shown to customers at checkout for offline payment. No code change
        required.
      </div>
      <PaymentSettingsForm initial={settings} />
    </div>
  );
}

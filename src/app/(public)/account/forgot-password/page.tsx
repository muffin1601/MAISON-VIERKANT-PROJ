import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountAuth } from "@/features/account/AccountAuth";

export const metadata: Metadata = { title: "Reset Password" };

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <AccountAuth mode="forgot" />
    </Suspense>
  );
}

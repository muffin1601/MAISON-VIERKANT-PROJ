import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountAuth } from "@/features/account/AccountAuth";

export const metadata: Metadata = { title: "Set New Password" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <AccountAuth mode="reset" />
    </Suspense>
  );
}

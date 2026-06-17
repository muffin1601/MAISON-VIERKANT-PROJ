import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountAuth } from "@/features/account/AccountAuth";

export const metadata: Metadata = { title: "Sign In" };

export default function CustomerLoginPage() {
  return (
    <Suspense>
      <AccountAuth mode="login" />
    </Suspense>
  );
}

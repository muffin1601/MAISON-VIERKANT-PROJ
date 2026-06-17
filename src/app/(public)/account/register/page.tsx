import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountAuth } from "@/features/account/AccountAuth";

export const metadata: Metadata = { title: "Create Account" };

export default function RegisterPage() {
  return (
    <Suspense>
      <AccountAuth mode="register" />
    </Suspense>
  );
}

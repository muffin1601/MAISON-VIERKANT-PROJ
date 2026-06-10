import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user && user.role !== "CUSTOMER") redirect("/admin/dashboard");

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

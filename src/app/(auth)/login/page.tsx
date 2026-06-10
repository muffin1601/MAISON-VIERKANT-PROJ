import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

// No server-side redirect here: redirecting an "already authenticated" user from the
// login page can create an infinite loop with the /admin middleware when the edge
// runtime and the server read the session cookie inconsistently (e.g. on Vercel).
// Post-login navigation is handled client-side in LoginForm via callbackUrl.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

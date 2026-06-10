"use client";

import { signOut } from "next-auth/react";

/** Styled by the prototype's `.a-exit button` rule. */
export function SignOutButton() {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/login" })}>
      ← Exit Console
    </button>
  );
}

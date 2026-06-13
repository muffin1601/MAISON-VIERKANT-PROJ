"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "@/components/ui/icons";

/** Styled by the prototype's `.a-exit button` rule. */
export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
    >
      <LogOut size={13} strokeWidth={1.5} />
      <span>Exit Console</span>
    </button>
  );
}

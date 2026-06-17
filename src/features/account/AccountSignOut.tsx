"use client";

import { signOut } from "next-auth/react";

export function AccountSignOut() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="btn-ghost"
      style={{ padding: "8px 16px", fontSize: 12 }}
    >
      Sign Out
    </button>
  );
}

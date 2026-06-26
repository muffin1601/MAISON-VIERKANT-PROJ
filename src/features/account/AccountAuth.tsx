"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { showToast } from "@/lib/toast";

type Mode = "login" | "register" | "forgot" | "reset";

const TITLES: Record<Mode, string> = {
  login: "Sign In",
  register: "Create Account",
  forgot: "Reset Password",
  reset: "Choose a New Password",
};

/** Storefront customer auth (email + password only — no SMS). */
export function AccountAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/account";
  const resetToken = params.get("token") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function postJson(url: string, payload: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const res = await signIn("credentials", { email, password, redirect: false });
        if (res?.error) {
          setError("Incorrect email or password.");
          return;
        }
        router.replace(callbackUrl);
        router.refresh();
        return;
      }

      if (mode === "register") {
        const { ok, json } = await postJson("/api/account/register", {
          name,
          email,
          phone,
          company,
          password,
        });
        if (!ok) {
          setError(json?.error?.message || "Could not create your account.");
          return;
        }
        // Auto sign-in after successful registration.
        const si = await signIn("credentials", { email, password, redirect: false });
        if (si?.error) {
          showToast("Account created. Please sign in.");
          router.replace("/account/login");
          return;
        }
        router.replace("/account");
        router.refresh();
        return;
      }

      if (mode === "forgot") {
        const { json } = await postJson("/api/account/forgot-password", { email });
        setDone(
          json?.data?.message ||
            "If an account exists for that email, a reset link has been sent.",
        );
        return;
      }

      if (mode === "reset") {
        const { ok, json } = await postJson("/api/account/reset-password", {
          token: resetToken,
          password,
        });
        if (!ok) {
          setError(json?.error?.message || "Could not reset your password.");
          return;
        }
        setDone("Your password has been reset. You can now sign in.");
        return;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 440, paddingTop: 32, paddingBottom: 56 }}>
        <h1 className="st" style={{ marginBottom: 8 }}>
          {TITLES[mode]}
        </h1>

        {done ? (
          <div
            style={{
              background: "var(--cream2)",
              border: "1px solid var(--cream3)",
              borderRadius: 2,
              padding: "16px 18px",
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--ink3)",
              marginTop: 16,
            }}
          >
            {done}
            <div style={{ marginTop: 14 }}>
              <Link className="btn-primary" href="/account/login" style={{ padding: "11px 24px" }}>
                Go to Sign In →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate style={{ marginTop: 16 }}>
            {error && (
              <div
                role="alert"
                style={{
                  background: "#fbeaea",
                  border: "1px solid #e3b6b6",
                  color: "var(--danger)",
                  borderRadius: 2,
                  padding: "10px 13px",
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            {mode === "register" && (
              <>
                <AField label="Full Name *" value={name} onChange={setName} placeholder="Your name" />
                <AField
                  label="Company / Firm"
                  value={company}
                  onChange={setCompany}
                  placeholder="Optional"
                />
                <AField
                  label="Phone"
                  value={phone}
                  onChange={setPhone}
                  placeholder="Optional"
                  type="tel"
                />
              </>
            )}

            {mode !== "reset" && (
              <AField
                label="Email *"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />
            )}

            {mode !== "forgot" && (
              <AField
                label="Password *"
                value={password}
                onChange={setPassword}
                placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            )}

            <button
              className="btn-primary"
              type="submit"
              disabled={busy}
              style={{ padding: "13px 28px", marginTop: 6, opacity: busy ? 0.6 : 1 }}
            >
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign In →"
                  : mode === "register"
                    ? "Create Account →"
                    : mode === "forgot"
                      ? "Send Reset Link →"
                      : "Reset Password →"}
            </button>

            <div style={{ marginTop: 18, fontSize: 12, color: "var(--ink4)", lineHeight: 2 }}>
              {mode === "login" && (
                <>
                  <Link href="/account/forgot-password" style={{ color: "var(--gold)" }}>
                    Forgot your password?
                  </Link>
                  <br />
                  New here?{" "}
                  <Link href="/account/register" style={{ color: "var(--gold)" }}>
                    Create an account
                  </Link>
                </>
              )}
              {mode === "register" && (
                <>
                  Already have an account?{" "}
                  <Link href="/account/login" style={{ color: "var(--gold)" }}>
                    Sign in
                  </Link>
                </>
              )}
              {(mode === "forgot" || mode === "reset") && (
                <Link href="/account/login" style={{ color: "var(--gold)" }}>
                  ← Back to sign in
                </Link>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function AField({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const autoId = useId();
  const id = rest.id ?? autoId;
  return (
    <div className="co-field" style={{ marginBottom: 14 }}>
      <label htmlFor={id}>{label}</label>
      <input {...rest} id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

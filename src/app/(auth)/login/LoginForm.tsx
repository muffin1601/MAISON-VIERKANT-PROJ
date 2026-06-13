"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { loginSchema, type LoginInput } from "@/validations/auth";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "@/components/ui/icons";
import styles from "./LoginForm.module.scss";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/admin";
  const [formError, setFormError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (res?.error) {
      setFormError("Incorrect email or password.");
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {/* Brand header on the ink panel */}
        <div className={styles.head}>
          <div className={styles.mark} aria-hidden>
            <svg viewBox="0 0 64 64" width="44" height="44">
              <rect x="10" y="10" width="44" height="44" rx="3" fill="none" stroke="var(--gold2)" strokeWidth="1.5" />
              <path
                d="M24 24 h16 a2 2 0 0 1 2 2 v6 a10 10 0 0 1 -10 10 a10 10 0 0 1 -10 -10 v-6 a2 2 0 0 1 2 -2 z"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <line x1="22" y1="46" x2="42" y2="46" stroke="var(--gold2)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className={styles.brand}>
            Maison <em>Vierkant</em>
          </div>
          <div className={styles.sub}>Admin &amp; Sales Console</div>
        </div>

        <form className={styles.body} onSubmit={handleSubmit(onSubmit)} noValidate>
          {formError && (
            <div className={styles.formError} role="alert">
              {formError}
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.label}>Email Address</span>
            <span className={styles.inputWrap}>
              <Mail size={15} strokeWidth={1.5} className={styles.leadIcon} />
              <input
                className={styles.input}
                type="email"
                autoComplete="email"
                placeholder="you@watcon.net"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
            </span>
            {errors.email && <span className={styles.error}>{errors.email.message}</span>}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <span className={styles.inputWrap}>
              <Lock size={15} strokeWidth={1.5} className={styles.leadIcon} />
              <input
                className={`${styles.input} ${styles.inputPw}`}
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password")}
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                title={showPw ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </span>
            {errors.password && <span className={styles.error}>{errors.password.message}</span>}
          </label>

          <button className={styles.button} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Enter Console"}
            {!isSubmitting && <ArrowRight size={15} strokeWidth={1.5} />}
          </button>

          <div className={styles.foot}>Secure access · Authorised personnel only</div>
        </form>
      </div>
      <div className={styles.copyright}>© 2026 Maison Vierkant India · Curated by Watcon</div>
    </div>
  );
}

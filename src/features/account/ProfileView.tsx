"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showToast } from "@/lib/toast";
import type { ProfileDto } from "@/services/account/profile";

const QK = ["account", "profile"] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong.");
  return json.data as T;
}

export function ProfileView() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: QK,
    queryFn: () => api<ProfileDto>("/api/account/profile"),
  });

  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");

  const nameVal = name ?? profile?.name ?? "";
  const phoneVal = phone ?? profile?.phone ?? "";

  const saveProfile = useMutation({
    mutationFn: () => api<ProfileDto>("/api/account/profile", { method: "PATCH", body: JSON.stringify({ name: nameVal, phone: phoneVal }) }),
    onSuccess: (data) => {
      showToast("Profile updated.");
      qc.setQueryData(QK, data);
      setName(null);
      setPhone(null);
    },
    onError: (e: Error) => showToast(e.message),
  });

  const changePwd = useMutation({
    mutationFn: () => api<{ ok: boolean }>("/api/account/change-password", { method: "POST", body: JSON.stringify({ currentPassword: cur, newPassword: next }) }),
    onSuccess: () => {
      showToast("Password changed.");
      setCur("");
      setNext("");
    },
    onError: (e: Error) => showToast(e.message),
  });

  const uploadAvatar = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append("file", f);
      return api<{ image: string }>("/api/account/avatar", { method: "POST", body: fd });
    },
    onSuccess: (data) => {
      showToast("Photo updated.");
      qc.setQueryData<ProfileDto>(QK, (p) => (p ? { ...p, image: data.image } : p));
    },
    onError: (e: Error) => showToast(e.message),
  });

  if (isLoading) return <div className="prof-card skeleton-card" style={{ height: 220 }} aria-busy="true" />;
  if (isError || !profile)
    return (
      <div className="addr-empty">
        <p>We couldn&apos;t load your profile.</p>
        <button className="btn-ghost" onClick={() => refetch()} style={{ marginTop: 8 }}>
          Try again
        </button>
      </div>
    );

  const initials = (profile.name || profile.email).slice(0, 1).toUpperCase();

  return (
    <div className="prof-wrap">
      {/* Identity header */}
      <div className="prof-head">
        <button
          type="button"
          className="prof-avatar"
          onClick={() => fileRef.current?.click()}
          aria-label="Change profile photo"
        >
          {profile.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.image} alt="" />
          ) : (
            <span>{initials}</span>
          )}
          <span className="prof-avatar-edit">{uploadAvatar.isPending ? "…" : "Edit"}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAvatar.mutate(f);
            e.target.value = "";
          }}
        />
        <div>
          <div className="prof-name">{profile.name || "Your name"}</div>
          <div className="prof-meta">{profile.email}</div>
          {profile.phone && <div className="prof-meta">+91 {profile.phone}</div>}
          <span className="prof-badge">{profile.membership} member</span>
        </div>
      </div>

      {/* Edit profile */}
      <section className="prof-card">
        <div className="co-section-title">Edit profile</div>
        <div className="co-2col">
          <div className="co-field">
            <label htmlFor="prof-name">Full name</label>
            <input id="prof-name" value={nameVal} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="co-field">
            <label htmlFor="prof-phone">Phone</label>
            <input
              id="prof-phone"
              value={phoneVal}
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel-national"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <div className="co-field">
          <label htmlFor="prof-email">Email</label>
          <input id="prof-email" value={profile.email} disabled title="Contact support to change your email" />
        </div>
        <button
          className="btn-primary"
          style={{ marginTop: 12, padding: "12px 28px" }}
          disabled={saveProfile.isPending}
          onClick={() => saveProfile.mutate()}
        >
          {saveProfile.isPending ? "Saving…" : "Save changes"}
        </button>
      </section>

      {/* Change password */}
      <section className="prof-card">
        <div className="co-section-title">Change password</div>
        <div className="co-2col">
          <div className="co-field">
            <label htmlFor="prof-cur-pw">Current password</label>
            <input id="prof-cur-pw" type="password" value={cur} autoComplete="current-password" onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="co-field">
            <label htmlFor="prof-new-pw">New password</label>
            <input id="prof-new-pw" type="password" value={next} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} />
          </div>
        </div>
        <p className="prof-hint">At least 8 characters with an uppercase letter, a lowercase letter and a number.</p>
        <button
          className="btn-dark"
          style={{ marginTop: 4, padding: "12px 28px" }}
          disabled={changePwd.isPending || !cur || !next}
          onClick={() => changePwd.mutate()}
        >
          {changePwd.isPending ? "Updating…" : "Update password"}
        </button>
      </section>
    </div>
  );
}

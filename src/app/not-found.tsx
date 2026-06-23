import Link from "next/link";

export default function NotFound() {
  return (
    <div className="route-loading" style={{ textAlign: "center", alignItems: "center", minHeight: "60vh", justifyContent: "center" }}>
      <h1 style={{ fontSize: 56, fontFamily: "'Cormorant Garamond', serif", margin: 0 }}>404</h1>
      <p style={{ color: "var(--ink4)" }}>This page doesn&apos;t exist or has moved.</p>
      <Link href="/" className="btn-dark" style={{ padding: "12px 28px", marginTop: 8 }}>
        Back to home
      </Link>
    </div>
  );
}

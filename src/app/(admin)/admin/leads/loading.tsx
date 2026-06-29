/** Skeleton shown while the Catalogue Leads server component streams in. */
export default function LeadsLoading() {
  const bar = (w: string | number) => (
    <div
      style={{
        height: 12,
        width: w,
        borderRadius: 3,
        background: "var(--cream3, #ece7df)",
        opacity: 0.7,
      }}
    />
  );

  return (
    <div className="a-page active" aria-busy="true" aria-live="polite">
      <div className="a-title">Catalogue Leads</div>
      <div className="a-sub">Catalogue requests &amp; contact enquiries — search, filter, export, and manage status</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        {bar(220)}
        {bar(150)}
        {bar(150)}
        {bar(110)}
      </div>

      <div className="a-card" style={{ display: "grid", gap: 14, padding: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {bar("18%")}
            {bar("22%")}
            {bar("20%")}
            {bar("14%")}
            {bar("12%")}
          </div>
        ))}
      </div>
    </div>
  );
}

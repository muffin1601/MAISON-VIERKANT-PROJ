/** Route-level loading skeleton for the public storefront. */
export default function PublicLoading() {
  return (
    <div className="route-loading" aria-busy="true" aria-label="Loading">
      <div className="skeleton-card" style={{ height: 40, maxWidth: 280 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ height: 240 }} />
        ))}
      </div>
    </div>
  );
}

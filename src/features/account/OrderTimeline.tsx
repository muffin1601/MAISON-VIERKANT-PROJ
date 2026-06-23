import { retailTimeline, statusMeta } from "@/lib/orderStatus";
import { Check } from "lucide-react";

/** Myntra-style horizontal progress timeline mapped from the internal order status. */
export function OrderTimeline({ status }: { status: string }) {
  const tl = retailTimeline(status);

  if (tl.terminal) {
    return (
      <div className="otl-terminal" style={{ borderColor: tl.terminal.color, color: tl.terminal.color }}>
        This order is <strong>{tl.terminal.label}</strong>.
      </div>
    );
  }

  return (
    <ol className="otl" aria-label="Order progress">
      {tl.stages.map((s, i) => (
        <li key={s.label} className={`otl-step${s.done ? " done" : ""}${s.current ? " current" : ""}`}>
          <span className="otl-dot" aria-hidden>
            {s.done ? <Check size={12} /> : <span className="otl-dot-i" />}
          </span>
          <span className="otl-label">{s.label}</span>
          {i < tl.stages.length - 1 && <span className="otl-bar" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

/** Vertical, dated history list (one row per recorded status event). */
export function OrderHistory({ events }: { events: { status: string; note: string | null; createdAt: Date }[] }) {
  if (events.length === 0) return null;
  return (
    <ul className="ohist">
      {[...events].reverse().map((e, i) => {
        const meta = statusMeta(e.status);
        return (
          <li key={i} className="ohist-row">
            <span className="ohist-dot" style={{ background: meta.color }} aria-hidden />
            <div>
              <div className="ohist-label">{meta.label}</div>
              {e.note && <div className="ohist-note">{e.note}</div>}
              <div className="ohist-date">
                {new Date(e.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import { Link } from "@/i18n/navigation";
import { USAGE } from "@/lib/data";
import { CountUp } from "@/components/count-up";

const BY_FEATURE = [
  { label: "Summarize", value: 148, pct: 47 },
  { label: "Ask anything", value: 92, pct: 29 },
  { label: "OCR", value: 51, pct: 16 },
  { label: "Translate", value: 25, pct: 8 },
];

const LIMITS = [
  ["AI actions", "Unlimited"],
  ["Pages per document", "300"],
  ["File size", "2 GB"],
  ["Retention", "1 hour"],
];

export default function UsagePage() {
  return (
    <div>
      <h1 style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(24px,3vw,34px)", lineHeight: 1.1, letterSpacing: "-.035em" }}>AI usage</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "var(--cs-text-2)" }}>Unlimited on Pro — shown so you can see where the time goes.</p>

      <div style={{ marginTop: 24, padding: 24, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 32, fontWeight: 600, letterSpacing: "-.04em" }}>
            <CountUp value={316} />
          </div>
          <div style={{ fontSize: 13.5, color: "var(--cs-text-2)" }}>AI actions this month · 42 this week</div>
        </div>
        <div style={{ marginTop: 26, display: "flex", alignItems: "flex-end", gap: "clamp(8px,2vw,20px)", height: 170 }}>
          {USAGE.map((u) => (
            <div key={u.day} style={{ flex: "1 1 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--cs-text-2)" }}>{u.value}</div>
              <div style={{ width: "100%", maxWidth: 56, borderRadius: "8px 8px 3px 3px", background: "linear-gradient(180deg,var(--cs-cyan),var(--cs-accent))", height: `${u.value}%` }} />
              <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--cs-text-2)" }}>{u.day}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))", gap: 14 }}>
        <div style={{ padding: 22, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>By feature</div>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            {BY_FEATURE.map((f) => (
              <div key={f.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{f.label}</span>
                  <span style={{ color: "var(--cs-text-2)" }}>{f.value}</span>
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 99, background: "var(--cs-line)", overflow: "hidden" }}>
                  <div style={{ width: `${f.pct}%`, height: "100%", borderRadius: 99, background: "var(--cs-grad)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: 22, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Limits</div>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5, color: "var(--cs-text-2)" }}>
            {LIMITS.map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>{label}</span>
                <span style={{ color: "var(--cs-text)" }}>{value}</span>
              </div>
            ))}
          </div>
          <Link href="/app/billing" style={{ marginTop: "auto", paddingTop: 20, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Manage plan &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

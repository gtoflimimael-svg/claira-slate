import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HISTORY } from "@/lib/data";
import { CountUp } from "@/components/count-up";

const QUICK_TOOLS = [
  { key: "quickToolMerge", href: "/tools/merge", d: "M3 3h10v10H3zM11 11h10v10H11z" },
  { key: "quickToolCompress", href: "/tools/compress", d: "M12 3v6M9 6l3 3 3-3M12 21v-6M9 18l3-3 3 3M4 12h16" },
  { key: "quickToolSummarize", href: "/ai/summarize", d: "M4 6h16M4 11h16M4 16h9" },
  { key: "quickToolAskAi", href: "/ai", d: "M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z" },
];

const KPI = [
  { key: "documentsThisMonth", value: 128, suffix: "", noteKey: "noteVsLastMonth", noteColor: "var(--cs-ok)" },
  { key: "aiActions", value: 42, suffix: "", noteKey: "noteUnlimitedPro", noteColor: "var(--cs-text-2)" },
  { key: "storageUsed", value: 1.4, suffix: " GB", bar: 28 },
  { key: "timeSaved", value: 6.5, suffix: " h", noteKey: "noteEstimated", noteColor: "var(--cs-text-2)" },
];

export default function AppHomePage() {
  const t = useTranslations("dashboard");
  const th = useTranslations("dashboard.home_");
  const recent = HISTORY.slice(0, 4);

  function statusStyle(available: boolean) {
    return {
      fg: available ? "var(--cs-ok)" : "var(--cs-text-2)",
      bg: available ? "color-mix(in oklab, var(--cs-ok) 12%, var(--cs-bg))" : "var(--cs-bg-2)",
      label: available ? t("available") : t("expired"),
    };
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(42px,5.25vw,59.5px)", lineHeight: 1.1, letterSpacing: "-.035em" }}>
            {th("greeting", { name: "Maya" })}
          </h1>
        </div>
        <Link
          href="/tools/merge"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 24.5, fontWeight: 500, cursor: "pointer" }}
        >
          {th("newFile")} &rarr;
        </Link>
      </div>

      <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(190px,100%),1fr))", gap: 12 }}>
        {KPI.map((k) => (
          <div key={k.key} style={{ padding: 20, border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-bg)" }}>
            <div style={{ fontSize: 21, fontWeight: 500, color: "var(--cs-text-2)" }}>{t(k.key)}</div>
            <div style={{ marginTop: 10, fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 52.5, fontWeight: 600, letterSpacing: "-.04em" }}>
              <CountUp value={k.value} />
              {k.suffix}
            </div>
            {k.bar !== undefined ? (
              <div style={{ marginTop: 10, height: 5, borderRadius: 99, background: "var(--cs-line)", overflow: "hidden" }}>
                <div style={{ width: `${k.bar}%`, height: "100%", background: "var(--cs-grad)", borderRadius: 99 }} />
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 21, fontWeight: 500, color: k.noteColor }}>{th(k.noteKey!)}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))", gap: 14, alignItems: "start" }}>
        <div style={{ padding: 22, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)" }}>
          <div style={{ fontSize: 22.75, fontWeight: 600 }}>{th("quickTools")}</div>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(120px,100%),1fr))", gap: 10 }}>
            {QUICK_TOOLS.map((tool) => (
              <Link
                key={tool.key}
                href={tool.href}
                data-lift
                style={{ display: "flex", flexDirection: "column", gap: 9, padding: 14, border: "1px solid var(--cs-line)", borderRadius: 10, color: "var(--cs-text)", fontSize: 22.75, fontWeight: 500, cursor: "pointer" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cs-accent)" strokeWidth="1.7" strokeLinecap="round">
                  <path d={tool.d}></path>
                </svg>
                {th(tool.key)}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ padding: 22, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 22.75, fontWeight: 600 }}>{th("recentActivity")}</div>
            <Link href="/app/history" style={{ fontSize: 21.88, fontWeight: 500, cursor: "pointer" }}>
              {th("viewAll")} &rarr;
            </Link>
          </div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>
            {recent.map((h) => {
              const s = statusStyle(h.available);
              return (
                <div key={h.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--cs-line)" }}>
                  <div style={{ flex: "none", width: 26, height: 32, borderRadius: 4, border: "1px solid var(--cs-line)", background: "var(--cs-bg-2)", display: "grid", placeItems: "center", fontSize: 13.12, fontWeight: 600, color: "var(--cs-bad)" }}>
                    PDF
                  </div>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 22.75, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                    <div style={{ marginTop: 3, fontSize: 20.12, color: "var(--cs-text-2)" }}>
                      {h.tool} · {h.when}
                    </div>
                  </div>
                  <span style={{ flex: "none", padding: "3px 9px", borderRadius: 6, fontSize: 19.25, fontWeight: 500, background: s.bg, color: s.fg }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 26,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: 22,
          border: "1px solid var(--cs-accent-line)",
          borderRadius: 20,
          background: "var(--cs-accent-soft)",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 29.75, fontWeight: 600, letterSpacing: "-.025em" }}>{th("teamPromoTitle")}</div>
          <div style={{ marginTop: 6, fontSize: 24.5, lineHeight: 1.55, color: "var(--cs-text-2)" }}>{th("teamPromoBody")}</div>
        </div>
        <Link
          href="/app/team"
          style={{ padding: "11px 18px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 24.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {th("teamPromoCta")} &rarr;
        </Link>
      </div>
    </div>
  );
}

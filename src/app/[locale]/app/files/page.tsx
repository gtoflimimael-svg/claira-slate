import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HISTORY } from "@/lib/data";

export default function FilesPage() {
  const t = useTranslations("dashboard.files_");
  const td = useTranslations("dashboard");

  function statusStyle(available: boolean) {
    return {
      fg: available ? "var(--cs-ok)" : "var(--cs-text-2)",
      bg: available ? "color-mix(in oklab, var(--cs-ok) 12%, var(--cs-bg))" : "var(--cs-bg-2)",
      label: available ? td("available") : td("expired"),
    };
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(24px,3vw,34px)", lineHeight: 1.1, letterSpacing: "-.035em" }}>{t("title")}</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "var(--cs-text-2)" }}>{t("subtitle")}</p>
        </div>
        <Link href="/tools/merge" style={{ padding: "11px 18px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          {t("uploadFile")}
        </Link>
      </div>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(220px,100%),1fr))", gap: 12 }}>
        <Link
          href="/tools/merge"
          className="hover-accent"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            minHeight: 184,
            padding: 20,
            border: "1.5px dashed var(--cs-accent-line)",
            borderRadius: "var(--cs-r)",
            background: "var(--cs-accent-soft)",
            color: "var(--cs-text)",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--cs-accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.24"></path>
            <path d="M12 21v-8"></path>
            <path d="M8 17l4-4 4 4"></path>
          </svg>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t("dropHere")}</div>
          <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t("upTo2gb")}</div>
        </Link>

        {HISTORY.map((h) => {
          const s = statusStyle(h.available);
          return (
            <div key={h.name} style={{ display: "flex", flexDirection: "column", minHeight: 184, padding: 18, border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-bg)" }}>
              <div style={{ width: 32, height: 40, borderRadius: 5, border: "1px solid var(--cs-line)", background: "var(--cs-bg-2)", display: "grid", placeItems: "center", fontSize: 8.5, fontWeight: 600, color: "var(--cs-bad)" }}>
                PDF
              </div>
              <div style={{ marginTop: 14, fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--cs-text-2)" }}>
                {h.pages} · {h.size}
              </div>
              <div style={{ marginTop: "auto", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: s.bg, color: s.fg }}>{s.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--cs-text-2)" }}>{h.when}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

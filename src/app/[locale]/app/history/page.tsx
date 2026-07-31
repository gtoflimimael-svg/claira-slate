"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HISTORY, type HistoryItem } from "@/lib/data";

const FILTER_KEYS = ["filterAll", "filterMerged", "filterCompressed", "filterConverted", "filterAiProcessed"] as const;
type Filter = (typeof FILTER_KEYS)[number];

const GROUPS: Record<Exclude<Filter, "filterAll">, string[]> = {
  filterMerged: ["Merge"],
  filterCompressed: ["Compress"],
  filterConverted: ["PDF to Word", "Split"],
  filterAiProcessed: ["Summarize (AI)", "OCR"],
};

function filterHistory(rows: HistoryItem[], filter: Filter, query: string) {
  const q = query.trim().toLowerCase();
  return rows.filter((h) => {
    const okFilter = filter === "filterAll" || GROUPS[filter as Exclude<Filter, "filterAll">].includes(h.tool);
    const okQuery = !q || h.name.toLowerCase().includes(q) || h.tool.toLowerCase().includes(q);
    return okFilter && okQuery;
  });
}

export default function HistoryPage() {
  const t = useTranslations("dashboard.history_");
  const td = useTranslations("dashboard");
  const [filter, setFilter] = useState<Filter>("filterAll");
  const [query, setQuery] = useState("");

  function statusStyle(available: boolean) {
    return {
      fg: available ? "var(--cs-ok)" : "var(--cs-text-2)",
      bg: available ? "color-mix(in oklab, var(--cs-ok) 12%, var(--cs-bg))" : "var(--cs-bg-2)",
      label: available ? td("available") : td("expired"),
    };
  }

  const rows = useMemo(() => filterHistory(HISTORY, filter, query), [filter, query]);
  const hasRows = rows.length > 0;

  return (
    <div>
      <h1 style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(24px,3vw,34px)", lineHeight: 1.1, letterSpacing: "-.035em" }}>{t("title")}</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "var(--cs-text-2)" }}>{t("subtitle")}</p>

      <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10, maxWidth: 420, padding: "11px 14px", border: "1px solid var(--cs-line)", borderRadius: 10, background: "var(--cs-bg)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-2)" strokeWidth="1.9" strokeLinecap="round" style={{ flex: "none" }}>
          <circle cx="11" cy="11" r="6.5"></circle>
          <path d="M16 16l4.5 4.5"></path>
        </svg>
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 auto", minWidth: 0, border: 0, background: "transparent", color: "var(--cs-text)", fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none" }}
        />
      </div>

      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 7 }}>
        {FILTER_KEYS.map((f) => {
          const on = f === filter;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "8px 13px",
                borderRadius: 99,
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                border: "1px solid",
                background: on ? "var(--cs-accent)" : "transparent",
                color: on ? "#fff" : "var(--cs-text-2)",
                borderColor: on ? "var(--cs-accent)" : "var(--cs-line)",
              }}
            >
              {t(f)}
            </button>
          );
        })}
      </div>

      {hasRows ? (
        <div style={{ marginTop: 20, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)", overflowX: "auto" }}>
          <div style={{ minWidth: 820 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1.2fr 1.2fr .8fr .9fr 1.3fr",
                padding: "14px 20px",
                borderBottom: "1px solid var(--cs-line)",
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: ".05em",
                textTransform: "uppercase",
                color: "var(--cs-text-2)",
              }}
            >
              <div>{t("colFileName")}</div>
              <div>{t("colTool")}</div>
              <div>{t("colDate")}</div>
              <div>{t("colSize")}</div>
              <div>{t("colStatus")}</div>
              <div>{t("colActions")}</div>
            </div>
            {rows.map((h) => {
              const s = statusStyle(h.available);
              return (
                <div
                  key={h.name}
                  style={{ display: "grid", gridTemplateColumns: "2.2fr 1.2fr 1.2fr .8fr .9fr 1.3fr", alignItems: "center", padding: "15px 20px", borderBottom: "1px solid var(--cs-line)", fontSize: 13.5 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <div style={{ flex: "none", width: 24, height: 30, borderRadius: 4, border: "1px solid var(--cs-line)", background: "var(--cs-bg-2)", display: "grid", placeItems: "center", fontSize: 7, fontWeight: 600, color: "var(--cs-bad)" }}>
                      PDF
                    </div>
                    <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                  </div>
                  <div style={{ color: "var(--cs-text-2)" }}>{h.tool}</div>
                  <div style={{ color: "var(--cs-text-2)" }}>{h.when}</div>
                  <div style={{ color: "var(--cs-text-2)" }}>{h.size}</div>
                  <div>
                    <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: s.bg, color: s.fg }}>{s.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12.5, fontWeight: 500 }}>
                    <Link href="/app/files" style={{ cursor: "pointer" }}>
                      {t("download")}
                    </Link>
                    <Link href="/tools/merge" className="hover-text" style={{ cursor: "pointer", color: "var(--cs-text-2)" }}>
                      {t("rerun")}
                    </Link>
                    <button
                      onClick={() => setQuery(query)}
                      className="hover-text"
                      style={{ cursor: "pointer", color: "var(--cs-text-2)", background: "none", border: 0, padding: 0, font: "inherit" }}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
              );
            })}
            <div style={{ padding: "14px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: "var(--cs-text-2)" }}>
              <span>{t("showing", { count: rows.length, total: 128 })}</span>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 20,
            padding: "clamp(40px,6vw,72px) 24px",
            border: "1px solid var(--cs-line)",
            borderRadius: 20,
            background: "var(--cs-bg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <div style={{ width: 38, height: 48, borderRadius: 6, border: "1.5px solid var(--cs-line)", background: "var(--cs-bg-2)" }}></div>
            <div style={{ width: 44, height: 58, borderRadius: 6, border: "1.5px solid var(--cs-accent-line)", background: "var(--cs-accent-soft)" }}></div>
            <div style={{ width: 38, height: 48, borderRadius: 6, border: "1.5px solid var(--cs-line)", background: "var(--cs-bg-2)" }}></div>
          </div>
          <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: "-.025em" }}>{t("emptyTitle")}</div>
          <div style={{ maxWidth: 320, fontSize: 14, lineHeight: 1.55, color: "var(--cs-text-2)" }}>{t("emptyBody")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center" }}>
            <Link href="/tools/merge" style={{ padding: "11px 18px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              {t("tryFirstTool")} &rarr;
            </Link>
            <button
              onClick={() => {
                setQuery("");
                setFilter("filterAll");
              }}
              className="hover-border"
              style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 14, fontWeight: 500, cursor: "pointer", background: "none" }}
            >
              {t("clearFilters")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

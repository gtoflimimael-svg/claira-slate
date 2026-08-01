"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Mode = "flowing" | "exact";

const sectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--cs-text-2)",
  textTransform: "uppercase",
  letterSpacing: ".03em",
};

const cardBase: CSSProperties = {
  border: "1.5px solid var(--cs-line)",
  borderRadius: 14,
  padding: 14,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const selectStyle: CSSProperties = {
  padding: "9px 10px",
  border: "1px solid var(--cs-line)",
  borderRadius: 8,
  background: "var(--cs-bg)",
  color: "var(--cs-text)",
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
  width: "100%",
};

const MODES: Mode[] = ["flowing", "exact"];
const LANGUAGES = ["auto", "en", "fr", "es", "de", "ar", "pt", "it", "ru", "ja", "ko", "zh", "hi"];

export function PdfToWordTool() {
  const t = useTranslations("pdfToWordTool");
  const tp = useTranslations("toolPage");

  const [mode, setMode] = useState<Mode>("flowing");
  const [preserveFormatting, setPreserveFormatting] = useState(true);
  const [convertTables, setConvertTables] = useState(true);
  const [embedImages, setEmbedImages] = useState(true);
  const [ocrForScanned, setOcrForScanned] = useState(false);
  const [language, setLanguage] = useState("auto");

  return (
    <SingleFileTool
      namespace="pdfToWordTool"
      apiPath="/api/tools/pdf-to-word"
      toolSlug="pdf-to-word"
      submitLabelKey="convertButton"
      buildConfig={() => ({ mode, preserveFormatting, convertTables, embedImages, language })}
      renderConfigPanel={({ disabled }) => (
        <>
          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={sectionTitle}>{t("modeHeading")}</div>
            {MODES.map((m) => {
              const selected = mode === m;
              return (
                <div
                  key={m}
                  style={{ ...cardBase, borderColor: selected ? "var(--cs-accent)" : "var(--cs-line)", background: selected ? "var(--cs-accent-soft)" : "transparent" }}
                  onClick={() => !disabled && setMode(m)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <span>{t(`mode.${m}.name`)}</span>
                    {selected && (
                      <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12.5l5 5L20 6.5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t(`mode.${m}.desc`)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={sectionTitle}>{t("optionsHeading")}</div>
            {[
              { checked: preserveFormatting, onChange: setPreserveFormatting, label: t("preserveFormattingLabel"), pro: false },
              { checked: convertTables, onChange: setConvertTables, label: t("convertTablesLabel"), pro: false },
              { checked: embedImages, onChange: setEmbedImages, label: t("embedImagesLabel"), pro: false },
              { checked: ocrForScanned, onChange: setOcrForScanned, label: t("ocrLabel"), pro: true },
            ].map((opt) => (
              <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
                {opt.pro && <span style={{ padding: "1px 6px", borderRadius: 6, background: "var(--cs-accent)", color: "#fff", fontSize: 9.5, fontWeight: 700 }}>PRO</span>}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)" }}>{t("languageHint")}</label>
            <select value={language} disabled={disabled} onChange={(e) => setLanguage(e.target.value)} style={selectStyle}>
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {t(`language.${code}`)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 16, border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-bg-2)", padding: 14, fontSize: 12.5, color: "var(--cs-text-2)", display: "flex", gap: 8 }}>
            <span>ℹ️</span>
            <span>{t("infoBanner")}</span>
          </div>

          <div style={{ marginTop: 12, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-accent-soft)", padding: 14, fontSize: 12.5, color: "var(--cs-text)" }}>
            💡 {tp("conversionQualityTip")}
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => (
        <>
          <div>{t("pagesConverted", { count: result.pagesConverted as number })}</div>
          <div>{t("imagesExtracted", { count: result.imagesExtracted as number })}</div>
          <div style={{ color: "var(--cs-text-2)", fontSize: 12 }}>{t("openHint")}</div>
        </>
      )}
    />
  );
}

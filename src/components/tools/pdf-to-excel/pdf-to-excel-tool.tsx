"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Mode = "auto" | "all-rows";

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

const MODES: Mode[] = ["auto", "all-rows"];

export function PdfToExcelTool() {
  const t = useTranslations("pdfToExcelTool");
  const tp = useTranslations("toolPage");

  const [mode, setMode] = useState<Mode>("auto");
  const [oneSheetPerPage, setOneSheetPerPage] = useState(true);
  const [preserveBorders, setPreserveBorders] = useState(true);
  const [autoFormat, setAutoFormat] = useState(true);
  const [includeImages, setIncludeImages] = useState(false);

  return (
    <SingleFileTool
      namespace="pdfToExcelTool"
      apiPath="/api/tools/pdf-to-excel"
      toolSlug="pdf-to-excel"
      submitLabelKey="convertButton"
      buildConfig={() => ({ mode, oneSheetPerPage, preserveBorders, autoFormat, includeImages })}
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
              { checked: oneSheetPerPage, onChange: setOneSheetPerPage, label: t("oneSheetPerPageLabel") },
              { checked: preserveBorders, onChange: setPreserveBorders, label: t("preserveBordersLabel") },
              { checked: autoFormat, onChange: setAutoFormat, label: t("autoFormatLabel") },
              { checked: includeImages, onChange: setIncludeImages, label: t("includeImagesLabel") },
            ].map((opt) => (
              <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ border: "1px solid var(--cs-ok)", borderRadius: 12, background: "var(--cs-accent-soft)", padding: 12, fontSize: 12.5 }}>✓ {t("worksBestWith")}</div>
            <div style={{ border: "1px solid var(--cs-accent-line)", borderRadius: 12, background: "var(--cs-card)", padding: 12, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 8 }}>
              <span>⚠️ {t("scannedWarning")}</span>
              <Link href="/tools/ocr" style={{ color: "var(--cs-accent)", fontWeight: 500, fontSize: 12.5 }}>
                {t("runOcrFirst")} &rarr;
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 12, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-accent-soft)", padding: 14, fontSize: 12.5, color: "var(--cs-text)" }}>
            💡 {tp("conversionQualityTip")}
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => (
        <>
          <div>{t("tablesFound", { count: result.tablesFound as number, pages: result.pagesScanned as number })}</div>
          <div>{t("rowsExtracted", { count: result.rowsExtracted as number })}</div>
          {includeImages && <div>{t("imagesEmbedded", { count: result.imagesEmbedded as number })}</div>}
          <div style={{ color: "var(--cs-text-2)", fontSize: 12 }}>{t("openHint")}</div>
        </>
      )}
    />
  );
}

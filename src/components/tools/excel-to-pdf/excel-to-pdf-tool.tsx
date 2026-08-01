"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Orientation = "portrait" | "landscape" | "auto";
type PaperSize = "a4" | "letter" | "a3" | "legal";

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

const ORIENTATIONS: Orientation[] = ["portrait", "landscape", "auto"];
const PAPER_SIZES: PaperSize[] = ["a4", "letter", "a3", "legal"];

export function ExcelToPdfTool() {
  const t = useTranslations("excelToPdfTool");

  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [fitToPage, setFitToPage] = useState(true);
  const [includeGridlines, setIncludeGridlines] = useState(true);
  const [includeSheetNames, setIncludeSheetNames] = useState(true);
  const [allSheets, setAllSheets] = useState(false);
  const [printAreaOnly, setPrintAreaOnly] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");

  return (
    <SingleFileTool
      namespace="excelToPdfTool"
      apiPath="/api/tools/excel-to-pdf"
      toolSlug="excel-to-pdf"
      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      fileKind="excel"
      submitLabelKey="convertButton"
      buildConfig={() => ({ orientation, fitToPage, includeGridlines, includeSheetNames, allSheets, printAreaOnly, paperSize })}
      renderConfigPanel={({ disabled }) => (
        <>
          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={sectionTitle}>{t("layoutHeading")}</div>
            {ORIENTATIONS.map((o) => {
              const selected = orientation === o;
              return (
                <div
                  key={o}
                  style={{ ...cardBase, borderColor: selected ? "var(--cs-accent)" : "var(--cs-line)", background: selected ? "var(--cs-accent-soft)" : "transparent" }}
                  onClick={() => !disabled && setOrientation(o)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <span>{t(`orientation.${o}.name`)}</span>
                    {selected && (
                      <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12.5l5 5L20 6.5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t(`orientation.${o}.desc`)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={sectionTitle}>{t("optionsHeading")}</div>
            {[
              { checked: fitToPage, onChange: setFitToPage, label: t("fitToPageLabel") },
              { checked: includeGridlines, onChange: setIncludeGridlines, label: t("includeGridlinesLabel") },
              { checked: includeSheetNames, onChange: setIncludeSheetNames, label: t("includeSheetNamesLabel") },
              { checked: allSheets, onChange: setAllSheets, label: t("allSheetsLabel") },
              { checked: printAreaOnly, onChange: setPrintAreaOnly, label: t("printAreaOnlyLabel") },
            ].map((opt) => (
              <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)" }}>{t("paperSizeHint")}</label>
            <select value={paperSize} disabled={disabled} onChange={(e) => setPaperSize(e.target.value as PaperSize)} style={selectStyle}>
              {PAPER_SIZES.map((size) => (
                <option key={size} value={size}>
                  {t(`paperSize.${size}`)}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => (
        <>
          <div>{t("sheetsConverted", { count: result.sheetsConverted as number })}</div>
          <div>{t("pagesCreated", { count: result.pagesCreated as number })}</div>
        </>
      )}
    />
  );
}

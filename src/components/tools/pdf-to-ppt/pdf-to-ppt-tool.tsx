"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Layout = "widescreen" | "standard";

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

const LAYOUTS: Layout[] = ["widescreen", "standard"];

export function PdfToPptTool() {
  const t = useTranslations("pdfToPptTool");
  const tp = useTranslations("toolPage");

  const [layout, setLayout] = useState<Layout>("widescreen");
  const [includeImages, setIncludeImages] = useState(true);
  const [includeTables, setIncludeTables] = useState(true);
  const [addSlideNumbers, setAddSlideNumbers] = useState(true);

  return (
    <SingleFileTool
      namespace="pdfToPptTool"
      apiPath="/api/tools/pdf-to-ppt"
      toolSlug="pdf-to-ppt"
      submitLabelKey="convertButton"
      buildConfig={() => ({ layout, includeImages, includeTables, addSlideNumbers })}
      renderConfigPanel={({ disabled }) => (
        <>
          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={sectionTitle}>{t("layoutHeading")}</div>
            {LAYOUTS.map((l) => {
              const selected = layout === l;
              return (
                <div
                  key={l}
                  style={{ ...cardBase, borderColor: selected ? "var(--cs-accent)" : "var(--cs-line)", background: selected ? "var(--cs-accent-soft)" : "transparent" }}
                  onClick={() => !disabled && setLayout(l)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <span>{t(`layout.${l}.name`)}</span>
                    {selected && (
                      <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12.5l5 5L20 6.5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t(`layout.${l}.desc`)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={sectionTitle}>{t("optionsHeading")}</div>
            {[
              { checked: includeImages, onChange: setIncludeImages, label: t("includeImagesLabel") },
              { checked: includeTables, onChange: setIncludeTables, label: t("includeTablesLabel") },
              { checked: addSlideNumbers, onChange: setAddSlideNumbers, label: t("addSlideNumbersLabel") },
            ].map((opt) => (
              <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
              </label>
            ))}
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
          <div>{t("slidesCreated", { count: result.slidesCreated as number })}</div>
          <div>{t("imagesEmbedded", { count: result.imagesEmbedded as number })}</div>
          <div style={{ color: "var(--cs-text-2)", fontSize: 12 }}>{t("openHint")}</div>
        </>
      )}
    />
  );
}

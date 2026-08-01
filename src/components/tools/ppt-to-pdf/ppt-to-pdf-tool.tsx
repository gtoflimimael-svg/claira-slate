"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Layout = "single" | "handout" | "notes";
type HandoutCount = 2 | 4 | 6;
type Quality = "standard" | "high";

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
  padding: "8px 10px",
  border: "1px solid var(--cs-line)",
  borderRadius: 8,
  background: "var(--cs-bg)",
  color: "var(--cs-text)",
  fontFamily: "inherit",
  fontSize: 13,
  outline: "none",
};

const proBadge: CSSProperties = { padding: "1px 6px", borderRadius: 6, background: "var(--cs-accent)", color: "#fff", fontSize: 9.5, fontWeight: 700 };

const LAYOUTS: Layout[] = ["single", "handout", "notes"];
const HANDOUT_COUNTS: HandoutCount[] = [2, 4, 6];

export function PptToPdfTool() {
  const t = useTranslations("pptToPdfTool");

  const [layout, setLayout] = useState<Layout>("single");
  const [handoutCount, setHandoutCount] = useState<HandoutCount>(4);
  const [preserveAnimations, setPreserveAnimations] = useState(true);
  const [includeHidden, setIncludeHidden] = useState(true);
  const [addSlideNumbers, setAddSlideNumbers] = useState(false);
  const [includeSpeakerNotesFooter, setIncludeSpeakerNotesFooter] = useState(false);
  const [quality, setQuality] = useState<Quality>("standard");

  const apiLayout = layout === "handout" ? (`handout-${handoutCount}` as const) : layout;

  return (
    <SingleFileTool
      namespace="pptToPdfTool"
      apiPath="/api/tools/ppt-to-pdf"
      toolSlug="ppt-to-pdf"
      accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
      fileKind="ppt"
      submitLabelKey="convertButton"
      buildConfig={() => ({ layout: apiLayout, includeHidden, addSlideNumbers, includeSpeakerNotesFooter, quality })}
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
                  {l === "handout" && selected && (
                    <select
                      value={handoutCount}
                      disabled={disabled}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setHandoutCount(Number(e.target.value) as HandoutCount)}
                      style={{ ...selectStyle, marginTop: 6 }}
                    >
                      {HANDOUT_COUNTS.map((n) => (
                        <option key={n} value={n}>
                          {t("handoutPerPage", { count: n })}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={sectionTitle}>{t("optionsHeading")}</div>
            {[
              { checked: preserveAnimations, onChange: setPreserveAnimations, label: t("preserveAnimationsLabel") },
              { checked: includeHidden, onChange: setIncludeHidden, label: t("includeHiddenLabel") },
              { checked: addSlideNumbers, onChange: setAddSlideNumbers, label: t("addSlideNumbersLabel") },
              { checked: includeSpeakerNotesFooter, onChange: setIncludeSpeakerNotesFooter, label: t("speakerNotesFooterLabel") },
            ].map((opt) => (
              <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={sectionTitle}>{t("qualityHeading")}</div>
            {(["standard", "high"] as Quality[]).map((q) => {
              const selected = quality === q;
              return (
                <div
                  key={q}
                  style={{ ...cardBase, borderColor: selected ? "var(--cs-accent)" : "var(--cs-line)", background: selected ? "var(--cs-accent-soft)" : "transparent" }}
                  onClick={() => !disabled && setQuality(q)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <span>{t(`quality.${q}`)}</span>
                    {q === "high" && <span style={proBadge}>PRO</span>}
                    {selected && (
                      <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12.5l5 5L20 6.5" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => (
        <div>{t("slidesConverted", { slides: result.slideCount as number, pages: result.pagesCreated as number })}</div>
      )}
    />
  );
}

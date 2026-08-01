"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Quality = "standard" | "high" | "compressed";

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

const inputStyle: CSSProperties = {
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

const proBadge: CSSProperties = { padding: "1px 6px", borderRadius: 6, background: "var(--cs-accent)", color: "#fff", fontSize: 9.5, fontWeight: 700 };

const QUALITIES: Quality[] = ["standard", "high", "compressed"];

export function WordToPdfTool() {
  const t = useTranslations("wordToPdfTool");
  const tp = useTranslations("toolPage");

  const [quality, setQuality] = useState<Quality>("standard");
  const [preserveFormatting, setPreserveFormatting] = useState(true);
  const [embedFonts, setEmbedFonts] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [password, setPassword] = useState("");

  return (
    <SingleFileTool
      namespace="wordToPdfTool"
      apiPath="/api/tools/word-to-pdf"
      toolSlug="word-to-pdf"
      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      fileKind="word"
      submitLabelKey="convertButton"
      buildConfig={() => ({ quality, embedFonts, includeComments, password: passwordProtect ? password : null })}
      validate={() => (passwordProtect && !password ? tp("passwordRequired") : null)}
      renderConfigPanel={({ disabled }) => (
        <>
          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={sectionTitle}>{t("qualityHeading")}</div>
            {QUALITIES.map((q) => {
              const selected = quality === q;
              return (
                <div
                  key={q}
                  style={{ ...cardBase, borderColor: selected ? "var(--cs-accent)" : "var(--cs-line)", background: selected ? "var(--cs-accent-soft)" : "transparent" }}
                  onClick={() => !disabled && setQuality(q)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <span>{t(`quality.${q}.name`)}</span>
                    {q === "high" && <span style={proBadge}>PRO</span>}
                    {selected && (
                      <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12.5l5 5L20 6.5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t(`quality.${q}.desc`)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={sectionTitle}>{t("optionsHeading")}</div>
            {[
              { checked: preserveFormatting, onChange: setPreserveFormatting, label: t("preserveFormattingLabel"), pro: false },
              { checked: embedFonts, onChange: setEmbedFonts, label: t("embedFontsLabel"), pro: false },
              { checked: includeComments, onChange: setIncludeComments, label: t("includeCommentsLabel"), pro: false },
              { checked: passwordProtect, onChange: setPasswordProtect, label: t("passwordProtectLabel"), pro: true },
            ].map((opt) => (
              <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
                {opt.pro && <span style={proBadge}>PRO</span>}
              </label>
            ))}
            {passwordProtect && (
              <input
                type="password"
                value={password}
                disabled={disabled}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                style={inputStyle}
              />
            )}
          </div>

          <div style={{ marginTop: 16, border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-bg-2)", padding: 14, fontSize: 12.5, color: "var(--cs-text-2)", display: "flex", gap: 8 }}>
            <span>✓</span>
            <span>{t("infoBanner")}</span>
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => (
        <div>{t("pagesCreated", { count: result.pagesCreated as number })}</div>
      )}
    />
  );
}

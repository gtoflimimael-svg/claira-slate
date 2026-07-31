"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { formatBytes } from "@/lib/format";
import { FileThumbnail } from "@/components/tools/file-thumbnail";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Mode = "grayscale" | "blackwhite" | "sepia";

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

const MODES: Mode[] = ["grayscale", "blackwhite", "sepia"];

const CSS_FILTER: Record<Mode, string> = {
  grayscale: "grayscale(100%)",
  blackwhite: "grayscale(100%) contrast(150%)",
  sepia: "sepia(100%)",
};

export function GrayscaleTool() {
  const t = useTranslations("grayscaleTool");

  const [mode, setMode] = useState<Mode>("grayscale");
  const [keepTextBlack, setKeepTextBlack] = useState(false);
  const [preserveImageQuality, setPreserveImageQuality] = useState(false);
  const [optimizeForPrint, setOptimizeForPrint] = useState(false);

  return (
    <SingleFileTool
      namespace="grayscaleTool"
      apiPath="/api/tools/grayscale"
      toolSlug="grayscale"
      submitLabelKey="grayscaleButton"
      buildConfig={() => ({ mode, keepTextBlack, preserveImageQuality, optimizeForPrint })}
      renderConfigPanel={({ disabled, file }) => (
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
              { label: t("keepTextBlackLabel"), checked: keepTextBlack, onChange: setKeepTextBlack },
              { label: t("preserveImageQualityLabel"), checked: preserveImageQuality, onChange: setPreserveImageQuality },
              { label: t("optimizeForPrintLabel"), checked: optimizeForPrint, onChange: setOptimizeForPrint },
            ].map((opt) => (
              <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ ...sectionTitle, marginBottom: 10 }}>{t("previewHeading")}</div>
            <div style={{ width: 140, aspectRatio: "0.78", borderRadius: 10, overflow: "hidden", border: "1px solid var(--cs-line)", filter: CSS_FILTER[mode] }}>
              <FileThumbnail file={file} isPdf />
            </div>
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => {
        const originalSize = result.originalSize as number;
        const imagesConverted = result.imagesConverted as number;
        return (
          <>
            <div>{t("colorsRemoved", { count: imagesConverted })}</div>
            <div>{t("beforeAfter", { before: formatBytes(originalSize), after: formatBytes(result.size) })}</div>
          </>
        );
      }}
    />
  );
}

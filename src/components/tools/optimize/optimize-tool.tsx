"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { formatBytes } from "@/lib/format";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Target = "web" | "email" | "archive";

const sectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--cs-text-2)",
  textTransform: "uppercase",
  letterSpacing: ".03em",
};

const INFO_KEYS = ["infoLinearize", "infoStreaming", "infoUnusedObjects", "infoFontEmbedding", "infoRedundantStreams"] as const;
const TARGETS: Target[] = ["web", "email", "archive"];

export function OptimizeTool() {
  const t = useTranslations("optimizeTool");

  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [removeThumbnails, setRemoveThumbnails] = useState(true);
  const [flattenForms, setFlattenForms] = useState(true);
  const [removeJS, setRemoveJS] = useState(true);
  const [removeAnnotations, setRemoveAnnotations] = useState(true);
  const [target, setTarget] = useState<Target>("web");

  return (
    <SingleFileTool
      namespace="optimizeTool"
      apiPath="/api/tools/optimize"
      toolSlug="optimize"
      submitLabelKey="optimizeButton"
      buildConfig={() => ({ removeMetadata, removeThumbnails, flattenForms, removeJS, removeAnnotations, target })}
      renderConfigPanel={({ disabled }) => (
        <>
          <div style={{ border: "1px solid var(--cs-accent-line)", borderRadius: 16, background: "var(--cs-accent-soft)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={sectionTitle}>{t("whatItDoesHeading")}</div>
            {INFO_KEYS.map((k) => (
              <div key={k} style={{ fontSize: 12.5, color: "var(--cs-text)", display: "flex", gap: 6 }}>
                <span style={{ color: "var(--cs-ok)" }}>✓</span>
                <span>{t(k)}</span>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={sectionTitle}>{t("optionsHeading")}</div>
            {[
              { key: "removeMetadata", label: t("removeMetadataLabel"), checked: removeMetadata, onChange: setRemoveMetadata },
              { key: "removeThumbnails", label: t("removeThumbnailsLabel"), checked: removeThumbnails, onChange: setRemoveThumbnails },
              { key: "flattenForms", label: t("flattenFormsLabel"), checked: flattenForms, onChange: setFlattenForms },
              { key: "removeJS", label: t("removeJSLabel"), checked: removeJS, onChange: setRemoveJS },
              { key: "removeAnnotations", label: t("removeAnnotationsLabel"), checked: removeAnnotations, onChange: setRemoveAnnotations },
            ].map((opt) => (
              <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={sectionTitle}>{t("targetHeading")}</div>
            {TARGETS.map((tg) => (
              <label key={tg} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="radio" name="optimize-target" checked={target === tg} disabled={disabled} onChange={() => setTarget(tg)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {t(`target.${tg}`)}
              </label>
            ))}
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => {
        const originalSize = result.originalSize as number;
        return (
          <>
            <div>{t("beforeAfter", { before: formatBytes(originalSize), after: formatBytes(result.size) })}</div>
            <div style={{ color: "var(--cs-ok)", fontWeight: 500 }}>✓ {t("linearizedNote")}</div>
          </>
        );
      }}
    />
  );
}

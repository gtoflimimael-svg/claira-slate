"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { formatBytes } from "@/lib/format";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

const sectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--cs-text-2)",
  textTransform: "uppercase",
  letterSpacing: ".03em",
};

const INFO_KEYS = ["infoFormFields", "infoAnnotations", "infoLayers", "infoPreventEditing", "infoReduceSize"] as const;

export function FlattenTool() {
  const t = useTranslations("flattenTool");

  const [flattenForms, setFlattenForms] = useState(true);
  const [flattenAnnotations, setFlattenAnnotations] = useState(true);
  const [flattenLayers, setFlattenLayers] = useState(true);
  const [removeHiddenLayers, setRemoveHiddenLayers] = useState(false);

  return (
    <SingleFileTool
      namespace="flattenTool"
      apiPath="/api/tools/flatten"
      toolSlug="flatten"
      submitLabelKey="flattenButton"
      buildConfig={() => ({ flattenForms, flattenAnnotations, flattenLayers, removeHiddenLayers })}
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
              { label: t("flattenFormsLabel"), checked: flattenForms, onChange: setFlattenForms },
              { label: t("flattenAnnotationsLabel"), checked: flattenAnnotations, onChange: setFlattenAnnotations },
              { label: t("flattenLayersLabel"), checked: flattenLayers, onChange: setFlattenLayers },
              { label: t("removeHiddenLayersLabel"), checked: removeHiddenLayers, onChange: setRemoveHiddenLayers },
            ].map((opt) => (
              <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--cs-text-2)", fontStyle: "italic" }}>{t("useCaseHint")}</div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => {
        const originalSize = result.originalSize as number;
        const fieldsFlattened = result.fieldsFlattened as number;
        const annotationsFlattened = result.annotationsFlattened as number;
        return (
          <>
            {fieldsFlattened > 0 && <div>{t("fieldsBakedIn", { count: fieldsFlattened })}</div>}
            {annotationsFlattened > 0 && <div>{t("annotationsBakedIn", { count: annotationsFlattened })}</div>}
            <div>{t("beforeAfter", { before: formatBytes(originalSize), after: formatBytes(result.size) })}</div>
          </>
        );
      }}
    />
  );
}

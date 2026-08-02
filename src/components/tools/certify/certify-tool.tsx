"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Standard = "pdfa1b" | "pdfa2b" | "pdfa3b";

interface Compliance {
  fontsEmbedded: boolean;
  colorSpaceIsRgb: boolean;
  hasJavaScript: boolean;
  hasTransparency: boolean;
}

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const cardBase: CSSProperties = { border: "1.5px solid var(--cs-line)", borderRadius: 14, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 };
const infoRow: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 };

const STANDARDS: Standard[] = ["pdfa1b", "pdfa2b", "pdfa3b"];

function CompliancePanel({ file }: { file: File }) {
  const t = useTranslations("certifyTool");
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/tools/certify", { method: "PUT", body: formData });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setCompliance(json.compliance);
      } catch {
        // Pre-check is best-effort UI feedback — conversion still runs without it.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (loading) {
    return <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("checking")}</div>;
  }
  if (!compliance) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={infoRow}>
        <span>{compliance.fontsEmbedded ? "✓" : "⚠️"}</span>
        <span>{compliance.fontsEmbedded ? t("check.fontsOk") : t("check.fontsWarn")}</span>
      </div>
      <div style={infoRow}>
        <span>{compliance.colorSpaceIsRgb ? "✓" : "⚠️"}</span>
        <span>{compliance.colorSpaceIsRgb ? t("check.colorOk") : t("check.colorWarn")}</span>
      </div>
      <div style={infoRow}>
        <span>{compliance.hasJavaScript ? "⚠️" : "✓"}</span>
        <span>{compliance.hasJavaScript ? t("check.jsWarn") : t("check.jsOk")}</span>
      </div>
      <div style={infoRow}>
        <span>{compliance.hasTransparency ? "⚠️" : "✓"}</span>
        <span>{compliance.hasTransparency ? t("check.transparencyWarn") : t("check.transparencyOk")}</span>
      </div>
    </div>
  );
}

export function CertifyTool() {
  const t = useTranslations("certifyTool");
  const [standard, setStandard] = useState<Standard>("pdfa1b");

  return (
    <SingleFileTool
      namespace="certifyTool"
      apiPath="/api/tools/certify"
      toolSlug="certify"
      submitLabelKey="certifyButton"
      buildConfig={() => ({ standard })}
      renderConfigPanel={({ disabled, file }) => (
        <>
          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={sectionTitle}>{t("standardHeading")}</div>
            {STANDARDS.map((s) => {
              const selected = standard === s;
              return (
                <div key={s} style={{ ...cardBase, borderColor: selected ? "var(--cs-accent)" : "var(--cs-line)", background: selected ? "var(--cs-accent-soft)" : "transparent" }} onClick={() => !disabled && setStandard(s)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <span>{t(`standard.${s}.name`)}</span>
                    {selected && (
                      <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12.5l5 5L20 6.5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t(`standard.${s}.desc`)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <div style={sectionTitle}>{t("whatItDoesHeading")}</div>
            {["readability", "embedFonts", "removeJs", "colorProfiles", "courtsArchives"].map((k) => (
              <div key={k} style={infoRow}>
                <span>✓</span>
                <span>{t(`info.${k}`)}</span>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <div style={sectionTitle}>{t("complianceCheckHeading")}</div>
            <CompliancePanel key={`${file.name}-${file.size}-${file.lastModified}`} file={file} />
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => (
        <>
          <div>{t("standardResult", { standard: t(`standard.${(result.standard as string) ?? "pdfa1b"}.name`) })}</div>
          {result.fullyCompliant === false && <div style={{ color: "var(--cs-text-2)", fontSize: 12 }}>{t("bestEffortNotice")}</div>}
        </>
      )}
    />
  );
}

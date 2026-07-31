"use client";

import { useTranslations } from "next-intl";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

export function RepairTool() {
  const t = useTranslations("repairTool");

  return (
    <SingleFileTool
      namespace="repairTool"
      apiPath="/api/tools/repair"
      toolSlug="repair"
      buildConfig={() => ({})}
      submitLabelKey="repairButton"
      renderConfigPanel={() => (
        <>
          <div style={{ border: "1px solid var(--cs-accent-line)", borderRadius: 16, background: "var(--cs-accent-soft)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>ℹ️ {t("infoHeading")}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--cs-text-2)", lineHeight: 1.7 }}>
              <li>{t("infoCorruptedStructure")}</li>
              <li>{t("infoMissingXref")}</li>
              <li>{t("infoBrokenStreams")}</li>
              <li>{t("infoTruncatedFiles")}</li>
            </ul>
          </div>
          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-card)", padding: 14, fontSize: 12.5, color: "var(--cs-text-2)", display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12 }}>
            <span>⚠️</span>
            <span>{t("warningSevereDamage")}</span>
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => {
        const fullyRecovered = result.fullyRecovered as boolean;
        const pagesRecovered = result.pagesRecovered as number;
        const pagesTotal = result.pagesTotal as number;
        if (fullyRecovered || !pagesTotal) return null;
        return (
          <div style={{ padding: 10, borderRadius: 10, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", fontSize: 12.5 }}>
            ⚠️ {t("partialRecovery", { recovered: pagesRecovered, total: pagesTotal })}
          </div>
        );
      }}
    />
  );
}

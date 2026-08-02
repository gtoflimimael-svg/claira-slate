"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SingleFileTool } from "@/components/tools/shared/single-file-tool";

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const inputWrap: CSSProperties = { position: "relative", display: "flex", alignItems: "center" };
const inputStyle: CSSProperties = { padding: "9px 38px 9px 10px", border: "1px solid var(--cs-line)", borderRadius: 8, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13.5, outline: "none", width: "100%" };
const eyeButton: CSSProperties = { position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--cs-text-2)", fontSize: 15, padding: 4 };

export function UnlockTool() {
  const t = useTranslations("unlockTool");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  return (
    <SingleFileTool
      namespace="unlockTool"
      apiPath="/api/tools/unlock"
      toolSlug="unlock"
      submitLabelKey="unlockButton"
      buildConfig={() => ({ password })}
      validate={() => (!password ? t("passwordRequired") : null)}
      renderConfigPanel={({ disabled }) => (
        <>
          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={sectionTitle}>{t("passwordHeading")}</div>
            <div style={inputWrap}>
              <input type={show ? "text" : "password"} value={password} disabled={disabled} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} style={inputStyle} />
              <button type="button" style={eyeButton} onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label="toggle password visibility">
                {show ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16, border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-bg-2)", padding: 14, fontSize: 12.5, color: "var(--cs-text-2)", display: "flex", gap: 8 }}>
            <span>ℹ️</span>
            <span>{t("infoBanner")}</span>
          </div>

          <div style={{ marginTop: 12, border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-card)", padding: 14, fontSize: 12.5, color: "var(--cs-text)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>✓ {t("whatWeRemoveHeading")}</div>
            <div style={{ color: "var(--cs-text-2)" }}>· {t("removeOpenPassword")}</div>
            <div style={{ color: "var(--cs-text-2)" }}>· {t("removeRestrictions")}</div>
          </div>

          <div style={{ marginTop: 12, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-accent-soft)", padding: 14, fontSize: 12.5, color: "var(--cs-text)" }}>
            ⚖️ {t("legalNotice")}
          </div>
        </>
      )}
    />
  );
}

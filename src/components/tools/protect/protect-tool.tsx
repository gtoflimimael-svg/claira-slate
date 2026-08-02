"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SingleFileTool, type SingleFileResult } from "@/components/tools/shared/single-file-tool";

type Encryption = "aes128" | "aes256";
type Strength = "weak" | "medium" | "strong";

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const cardBase: CSSProperties = { border: "1.5px solid var(--cs-line)", borderRadius: 14, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 };
const inputWrap: CSSProperties = { position: "relative", display: "flex", alignItems: "center" };
const inputStyle: CSSProperties = { padding: "9px 38px 9px 10px", border: "1px solid var(--cs-line)", borderRadius: 8, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13.5, outline: "none", width: "100%" };
const eyeButton: CSSProperties = { position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--cs-text-2)", fontSize: 15, padding: 4 };
const proBadge: CSSProperties = { padding: "1px 6px", borderRadius: 6, background: "var(--cs-accent)", color: "#fff", fontSize: 9.5, fontWeight: 700 };

function estimateStrength(pw: string): Strength {
  if (!pw) return "weak";
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 2) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

function PasswordField({ value, onChange, disabled, placeholder }: { value: string; onChange: (v: string) => void; disabled: boolean; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={inputWrap}>
      <input type={show ? "text" : "password"} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      <button type="button" style={eyeButton} onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label="toggle password visibility">
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}

export function ProtectTool() {
  const t = useTranslations("protectTool");

  const [openPassword, setOpenPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [permissionsPassword, setPermissionsPassword] = useState("");
  const [permPrint, setPermPrint] = useState(true);
  const [permCopy, setPermCopy] = useState(true);
  const [permEdit, setPermEdit] = useState(false);
  const [permAnnotate, setPermAnnotate] = useState(false);
  const [permFillForms, setPermFillForms] = useState(false);
  const [encryption, setEncryption] = useState<Encryption>("aes128");

  const strength = useMemo(() => estimateStrength(openPassword), [openPassword]);

  return (
    <SingleFileTool
      namespace="protectTool"
      apiPath="/api/tools/protect"
      toolSlug="protect"
      submitLabelKey="protectButton"
      buildConfig={() => ({
        openPassword,
        permissionsPassword: permissionsPassword || null,
        permissions: { print: permPrint, copy: permCopy, edit: permEdit, annotate: permAnnotate, fillForms: permFillForms },
        encryption,
      })}
      validate={() => {
        if (!openPassword) return t("openPasswordRequired");
        if (openPassword !== confirmPassword) return t("passwordMismatch");
        return null;
      }}
      renderConfigPanel={({ disabled }) => (
        <>
          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={sectionTitle}>{t("openPasswordHeading")}</div>
            <PasswordField value={openPassword} onChange={setOpenPassword} disabled={disabled} placeholder={t("passwordPlaceholder")} />
            <PasswordField value={confirmPassword} onChange={setConfirmPassword} disabled={disabled} placeholder={t("confirmPlaceholder")} />
            {openPassword && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <div style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--cs-line)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: strength === "weak" ? "33%" : strength === "medium" ? "66%" : "100%",
                      background: strength === "weak" ? "#e5484d" : strength === "medium" ? "#f5a623" : "var(--cs-ok)",
                      borderRadius: 99,
                    }}
                  />
                </div>
                <span style={{ color: "var(--cs-text-2)", fontWeight: 500 }}>{t(`strength.${strength}`)}</span>
              </div>
            )}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={{ ...sectionTitle, display: "flex", alignItems: "center", gap: 6 }}>
              {t("permissionsPasswordHeading")}
              <span style={proBadge}>PRO</span>
            </div>
            <PasswordField value={permissionsPassword} onChange={setPermissionsPassword} disabled={disabled} placeholder={t("permissionsPasswordPlaceholder")} />
            <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t("permissionsPasswordHint")}</div>
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={{ ...sectionTitle, display: "flex", alignItems: "center", gap: 6 }}>
              {t("permissionsHeading")}
              <span style={proBadge}>PRO</span>
            </div>
            {[
              { checked: permPrint, onChange: setPermPrint, label: t("allowPrintLabel") },
              { checked: permCopy, onChange: setPermCopy, label: t("allowCopyLabel") },
              { checked: permEdit, onChange: setPermEdit, label: t("allowEditLabel") },
              { checked: permAnnotate, onChange: setPermAnnotate, label: t("allowAnnotateLabel") },
              { checked: permFillForms, onChange: setPermFillForms, label: t("allowFillFormsLabel") },
            ].map((opt) => (
              <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>

          <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={sectionTitle}>{t("encryptionHeading")}</div>
            {(["aes128", "aes256"] as Encryption[]).map((enc) => {
              const selected = encryption === enc;
              return (
                <div key={enc} style={{ ...cardBase, borderColor: selected ? "var(--cs-accent)" : "var(--cs-line)", background: selected ? "var(--cs-accent-soft)" : "transparent" }} onClick={() => !disabled && setEncryption(enc)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <span>{t(`encryption.${enc}.name`)}</span>
                    {enc === "aes256" && <span style={proBadge}>PRO</span>}
                    {selected && (
                      <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12.5l5 5L20 6.5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t(`encryption.${enc}.desc`)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-accent-soft)", padding: 14, fontSize: 12.5, color: "var(--cs-text)", display: "flex", gap: 8 }}>
            <span>⚠️</span>
            <span>{t("warningBanner")}</span>
          </div>
        </>
      )}
      renderResultDetails={(result: SingleFileResult) => <div>{t("protectedWith", { encryption: (result.encryption as string) === "aes256" ? "AES-256" : "AES-128" })}</div>}
    />
  );
}

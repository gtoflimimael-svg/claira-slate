"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const fieldLabel: CSSProperties = { display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 500, color: "var(--cs-text-2)" };
const fieldInput: CSSProperties = {
  padding: "12px 14px",
  border: "1px solid var(--cs-line)",
  borderRadius: 10,
  background: "var(--cs-bg)",
  color: "var(--cs-text)",
  fontFamily: "Inter, sans-serif",
  fontSize: 14,
  outline: "none",
};

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError(t("errorEnterEmail"));
      return;
    }
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (!res.ok) {
      setError(t("errorGeneric"));
      return;
    }
    setSent(true);
  }

  return (
    <section style={{ maxWidth: 440, margin: "0 auto", padding: "clamp(48px,8vw,96px) 24px clamp(64px,8vw,112px)" }}>
      <style>{`.cs-field:focus{border-color:var(--cs-accent)}`}</style>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width="40" height="40" viewBox="0 0 120 120" fill="none" role="img" aria-label="Claira Slate">
          <path d="M62 28C42 28 26 42 26 60C26 78 42 92 62 92" fill="none" stroke="var(--cs-accent)" strokeWidth="12" strokeLinecap="round"></path>
          <path
            d="M68 28C88 28 94 38 94 47C94 56 84 60 74 60C64 60 54 64 54 73C54 82 60 92 80 92"
            fill="none"
            stroke="var(--cs-logo-s)"
            strokeWidth="12"
            strokeLinecap="round"
          ></path>
        </svg>
      </div>
      <h1
        style={{
          margin: "26px 0 0",
          textAlign: "center",
          fontFamily: "var(--font-geist), Inter, sans-serif",
          fontWeight: 600,
          fontSize: "clamp(26px,3.4vw,32px)",
          lineHeight: 1.15,
          letterSpacing: "-.032em",
        }}
      >
        {t("resetPasswordTitle")}
      </h1>
      <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 14.5, color: "var(--cs-text-2)" }}>{t("resetPasswordSubtitle")}</p>

      <div style={{ marginTop: 30, padding: "clamp(22px,3vw,28px)", border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}>
        {sent ? (
          <div style={{ padding: "8px 0", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: "-.025em" }}>{t("checkEmail")}</div>
            <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
              {t("resetSentEmail", { email })}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={fieldLabel}>
              {t("email")}
              <input className="cs-field" type="email" placeholder="you@company.com" style={fieldInput} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && <div style={{ fontSize: 13, color: "var(--cs-bad)" }}>{error}</div>}
            <button
              type="submit"
              className="hover-bg"
              disabled={loading}
              style={{ display: "block", textAlign: "center", padding: 13, border: "none", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? t("sending") : t("sendResetLink")}
            </button>
          </form>
        )}
      </div>

      <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 13.5, color: "var(--cs-text-2)" }}>
        <Link href="/login" style={{ fontWeight: 500, cursor: "pointer" }}>{t("backToLogin")}</Link>
      </p>
    </section>
  );
}

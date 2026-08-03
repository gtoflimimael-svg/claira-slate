"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

const PERK_KEYS = ["perk1", "perk2", "perk3", "perk4"] as const;

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

export default function SignupPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 10) {
      setError(t("errorSignupFields"));
      return;
    }
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));

    setLoading(false);
    if (!res.ok) {
      setError(data.error || t("errorGeneric"));
      return;
    }
    track("signup_completed", { method: "email" });
    setSent(true);
  }

  async function handleGoogleSignup() {
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/app` },
    });
    if (oauthError) {
      setError(oauthError.message);
      return;
    }
    track("signup_completed", { method: "google" });
  }

  return (
    <section style={{ padding: "clamp(48px,7vw,96px) 24px clamp(64px,8vw,112px)" }}>
      <style>{`.cs-field:focus{border-color:var(--cs-accent)}`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "center" }}>
        <div>
          <h1
            style={{
              margin: 0,
              maxWidth: 420,
              fontFamily: "var(--font-geist), Inter, sans-serif",
              fontWeight: 600,
              fontSize: "clamp(32px,4.6vw,48px)",
              lineHeight: 1.05,
              letterSpacing: "-.04em",
            }}
          >
            {t("signupTitle")}
          </h1>
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
            {PERK_KEYS.map((key) => (
              <div key={key} style={{ display: "flex", gap: 11, fontSize: 15, lineHeight: 1.55, color: "var(--cs-text-2)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none", marginTop: 3 }}>
                  <path d="M4 12.5l5 5L20 6.5"></path>
                </svg>
                {t(key)}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, padding: "18px 20px", border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-bg-2)", fontSize: 14, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
            &ldquo;{t("testimonialQuote")}&rdquo;
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>{t("testimonialAttribution")}</div>
          </div>
        </div>

        <div
          style={{ padding: "clamp(24px,3vw,32px)", border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}
        >
          {sent ? (
            <div style={{ padding: "20px 0", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: "-.025em" }}>{t("checkEmail")}</div>
              <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
                {t("confirmationSentEmail", { email })}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <svg width="30" height="30" viewBox="0 0 120 120" fill="none" role="img" aria-label="Claira Slate">
                  <path d="M62 28C42 28 26 42 26 60C26 78 42 92 62 92" fill="none" stroke="var(--cs-accent)" strokeWidth="12" strokeLinecap="round"></path>
                  <path
                    d="M68 28C88 28 94 38 94 47C94 56 84 60 74 60C64 60 54 64 54 73C54 82 60 92 80 92"
                    fill="none"
                    stroke="var(--cs-logo-s)"
                    strokeWidth="12"
                    strokeLinecap="round"
                  ></path>
                </svg>
                <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-.025em" }}>{t("createAccountHeading")}</div>
              </div>
              <button
                type="button"
                className="hover-text"
                style={{
                  marginTop: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  padding: 12,
                  border: "1px solid var(--cs-line)",
                  borderRadius: 10,
                  background: "transparent",
                  color: "var(--cs-text)",
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                }}
                onClick={handleGoogleSignup}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t("continueWithGoogle")}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
                <span style={{ flex: "1 1 auto", height: 1, background: "var(--cs-line)" }}></span>
                {tc("or")}
                <span style={{ flex: "1 1 auto", height: 1, background: "var(--cs-line)" }}></span>
              </div>
              <label style={fieldLabel}>
                {t("workEmail")}
                <input className="cs-field" type="email" placeholder="you@company.com" style={fieldInput} value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label style={fieldLabel}>
                {t("password")}
                <input className="cs-field" type="password" placeholder={t("passwordPlaceholder")} style={fieldInput} value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {error && <div style={{ fontSize: 13, color: "var(--cs-bad)" }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, padding: "12px 14px", borderRadius: 10, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", fontSize: 12.5, lineHeight: 1.5, color: "var(--cs-text-2)" }}>
                {t("freePlanSelected")} <Link href="/pricing" style={{ fontWeight: 500, cursor: "pointer" }}>{t("comparePlans")} &rarr;</Link>
              </div>
              <button
                type="submit"
                className="hover-bg"
                disabled={loading}
                style={{ display: "block", textAlign: "center", padding: 13, border: "none", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? t("creatingAccount") : t("createAccount")}
              </button>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--cs-text-2)" }}>{t("termsNotice")}</div>
              <div style={{ textAlign: "center", fontSize: 13.5, color: "var(--cs-text-2)" }}>
                {t("alreadyHaveAccount")} <Link href="/login" style={{ fontWeight: 500, cursor: "pointer" }}>{t("logIn")}</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

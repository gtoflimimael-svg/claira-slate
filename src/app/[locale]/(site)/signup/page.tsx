"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

const PERKS = [
  "All 26 tools, no watermarks",
  "Two AI actions every day",
  "File history you can actually find",
  "Upgrade or leave whenever",
];

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 10) {
      setError("Enter a work email and a password of at least 10 characters.");
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
      setError(data.error || "Something went wrong. Try again.");
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
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(48px,7vw,96px) 24px clamp(64px,8vw,112px)" }}>
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
            {PERKS.map((p) => (
              <div key={p} style={{ display: "flex", gap: 11, fontSize: 15, lineHeight: 1.55, color: "var(--cs-text-2)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none", marginTop: 3 }}>
                  <path d="M4 12.5l5 5L20 6.5"></path>
                </svg>
                {p}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, padding: "18px 20px", border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-bg-2)", fontSize: 14, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
            &ldquo;We replaced three separate tools with Claira Slate.&rdquo;
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>Maya Rendel · Ops Lead, Northwind</div>
          </div>
        </div>

        <div
          style={{ padding: "clamp(24px,3vw,32px)", border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}
        >
          {sent ? (
            <div style={{ padding: "20px 0", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: "-.025em" }}>{t("checkEmail")}</div>
              <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
                We sent a confirmation link to <strong>{email}</strong>. Click it to verify your account and get started.
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
                <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-.025em" }}>Create your account</div>
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
                <span style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid var(--cs-text-2)" }}></span>
                {t("continueWithGoogle")}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
                <span style={{ flex: "1 1 auto", height: 1, background: "var(--cs-line)" }}></span>
                OR
                <span style={{ flex: "1 1 auto", height: 1, background: "var(--cs-line)" }}></span>
              </div>
              <label style={fieldLabel}>
                {t("workEmail")}
                <input className="cs-field" type="email" placeholder="you@company.com" style={fieldInput} value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label style={fieldLabel}>
                {t("password")}
                <input className="cs-field" type="password" placeholder="At least 10 characters" style={fieldInput} value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {error && <div style={{ fontSize: 13, color: "var(--cs-bad)" }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, padding: "12px 14px", borderRadius: 10, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", fontSize: 12.5, lineHeight: 1.5, color: "var(--cs-text-2)" }}>
                Free plan selected. <Link href="/pricing" style={{ fontWeight: 500, cursor: "pointer" }}>Compare plans &rarr;</Link>
              </div>
              <button
                type="submit"
                className="hover-bg"
                disabled={loading}
                style={{ display: "block", textAlign: "center", padding: 13, border: "none", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Creating account…" : t("createAccount")}
              </button>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--cs-text-2)" }}>By continuing you agree to our terms. Files are deleted after one hour.</div>
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

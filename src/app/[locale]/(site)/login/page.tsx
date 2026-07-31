"use client";

import { Suspense, useState, type CSSProperties, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

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
const oauthButton: CSSProperties = {
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
};

function LoginForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(searchParams.get("error") ? t("errorWrongLoginAttempt") : "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(t("errorEnterEmailPassword"));
      return;
    }
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    track("login_completed", { method: "email" });
    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogleLogin() {
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` },
    });
    if (oauthError) {
      setError(oauthError.message);
      return;
    }
    track("login_completed", { method: "google" });
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
        {t("loginTitle")}
      </h1>
      <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 14.5, color: "var(--cs-text-2)" }}>{t("loginSubtitle")}</p>

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 30, padding: "clamp(22px,3vw,28px)", border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" className="hover-text" style={oauthButton} onClick={handleGoogleLogin}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t("continueWithGoogle")}
          </button>
          <button type="button" className="hover-text" style={{ ...oauthButton, opacity: 0.5, cursor: "not-allowed" }} disabled title={t("ssoComingSoon")}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M8 21v-4h8v4M8 11h2M14 11h2M8 15h2M14 15h2" />
            </svg>
            {t("continueWithSso")}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
          <span style={{ flex: "1 1 auto", height: 1, background: "var(--cs-line)" }}></span>
          {tc("or")}
          <span style={{ flex: "1 1 auto", height: 1, background: "var(--cs-line)" }}></span>
        </div>

        <label style={fieldLabel}>
          {t("email")}
          <input className="cs-field" type="email" placeholder="you@company.com" style={fieldInput} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label style={fieldLabel}>
          {t("password")}
          <input className="cs-field" type="password" placeholder="••••••••" style={fieldInput} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error && <div style={{ fontSize: 13, color: "var(--cs-bad)" }}>{error}</div>}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cs-text-2)" }}>
            <input type="checkbox" style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {t("rememberMe")}
          </label>
          <Link href="/forgot-password" style={{ fontWeight: 500, cursor: "pointer" }}>
            {t("forgotPassword")}
          </Link>
        </div>

        <button
          type="submit"
          className="hover-bg"
          disabled={loading}
          style={{ display: "block", textAlign: "center", padding: 13, border: "none", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? t("loggingIn") : t("logIn")}
        </button>
      </form>

      <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 13.5, color: "var(--cs-text-2)" }}>
        {t("newHere")} <Link href="/signup" style={{ fontWeight: 500, cursor: "pointer" }}>{t("createAccount")}</Link>
      </p>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

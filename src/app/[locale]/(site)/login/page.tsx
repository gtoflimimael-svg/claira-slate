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
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(searchParams.get("error") ? "That didn't work — please sign in again." : "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
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
            <span style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid var(--cs-text-2)" }}></span>
            {t("continueWithGoogle")}
          </button>
          <button type="button" className="hover-text" style={{ ...oauthButton, opacity: 0.5, cursor: "not-allowed" }} disabled title="Coming soon">
            <span style={{ width: 16, height: 16, borderRadius: 4, border: "1.5px solid var(--cs-text-2)" }}></span>
            Continue with SSO
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
          <span style={{ flex: "1 1 auto", height: 1, background: "var(--cs-line)" }}></span>
          OR
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
          {loading ? "Logging in…" : t("logIn")}
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

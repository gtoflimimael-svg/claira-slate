"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

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

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError(t("errorPasswordTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("errorPasswordsDontMatch"));
      return;
    }
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <section style={{ maxWidth: 440, margin: "0 auto", padding: "clamp(48px,8vw,96px) 24px clamp(64px,8vw,112px)" }}>
      <style>{`.cs-field:focus{border-color:var(--cs-accent)}`}</style>
      <h1
        style={{
          margin: 0,
          textAlign: "center",
          fontFamily: "var(--font-geist), Inter, sans-serif",
          fontWeight: 600,
          fontSize: "clamp(26px,3.4vw,32px)",
          lineHeight: 1.15,
          letterSpacing: "-.032em",
        }}
      >
        {t("setNewPasswordTitle")}
      </h1>
      <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 14.5, color: "var(--cs-text-2)" }}>{t("choosePasswordHint")}</p>

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 30, padding: "clamp(22px,3vw,28px)", border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <label style={fieldLabel}>
          {t("password")}
          <input className="cs-field" type="password" placeholder="At least 10 characters" style={fieldInput} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label style={fieldLabel}>
          {t("confirmPassword")}
          <input className="cs-field" type="password" placeholder="Repeat password" style={fieldInput} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <div style={{ fontSize: 13, color: "var(--cs-bad)" }}>{error}</div>}
        <button
          type="submit"
          className="hover-bg"
          disabled={loading}
          style={{ display: "block", textAlign: "center", padding: 13, border: "none", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? t("saving") : t("updatePassword")}
        </button>
      </form>
    </section>
  );
}

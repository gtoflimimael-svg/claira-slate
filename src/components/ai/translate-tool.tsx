"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AIUsageLimitModal } from "@/components/billing/ai-usage-limit-modal";
import { TRANSLATE_LANGUAGES } from "@/lib/languages";
import { track } from "@/lib/analytics";

interface TranslateResult {
  translatedText: string;
  originalLanguage: string;
  pdfBase64: string | null;
}

const fieldInput: React.CSSProperties = {
  padding: "12px 14px",
  border: "1px solid var(--cs-line)",
  borderRadius: 10,
  background: "var(--cs-bg)",
  color: "var(--cs-text)",
  fontFamily: "inherit",
  fontSize: 14,
  outline: "none",
};

const primaryButton: React.CSSProperties = {
  padding: "13px 24px",
  borderRadius: 10,
  background: "var(--cs-accent)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 500,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 15px",
  borderRadius: 9,
  border: "1px solid var(--cs-line)",
  background: "transparent",
  color: "var(--cs-text)",
  fontSize: 13.5,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

export function TranslateTool() {
  const t = useTranslations("aiTool.translate");
  const tc = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState(TRANSLATE_LANGUAGES[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);

  function pickFile(next: File | null) {
    setFile(next);
    setResult(null);
    setError("");
  }

  async function handleTranslate() {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetLanguage", targetLanguage);
      const res = await fetch("/api/ai/translate", { method: "POST", body: formData });
      const data = await res.json();

      if (res.status === 429) {
        setLimit(data.limit ?? 5);
        track("quota_limit_reached", { feature: "translate", plan: data.plan ?? "free" });
        return;
      }
      if (!res.ok) {
        setError(data.error || tc("error"));
        return;
      }

      setResult(data);
      track("ai_feature_used", { feature: "translate", user_plan: data.plan ?? "free", tokens_used: data.tokensUsed ?? 0 });
    } catch {
      setError(tc("couldntReachServer"));
    } finally {
      setLoading(false);
    }
  }

  function downloadPdf() {
    if (!result?.pdfBase64) return;
    const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(file?.name ?? "document").replace(/\.pdf$/i, "")}-${targetLanguage}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyText() {
    if (!result) return;
    navigator.clipboard.writeText(result.translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) pickFile(dropped);
        }}
        style={{
          border: `1.5px dashed ${dragging ? "var(--cs-accent)" : "var(--cs-accent-line)"}`,
          borderRadius: 20,
          background: "var(--cs-accent-soft)",
          padding: "clamp(28px,4vw,44px) 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 14,
        }}
      >
        <div style={{ color: "var(--cs-accent)" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h9M8.5 6c0 5-2 8-5.5 10M6 11c1.5 3 4 4.5 7 5M13 20l4-10 4 10M14.6 17h4.8"></path>
          </svg>
        </div>
        <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: "-.025em", overflowWrap: "anywhere" }}>
          {file ? file.name : t("dropHeading")}
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 240, textAlign: "left", fontSize: 12.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
          {t("translateToLabel")}
          <select className="cs-field" style={fieldInput} value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
            {TRANSLATE_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </label>

        <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="hover-text" style={file ? secondaryButton : primaryButton} onClick={() => inputRef.current?.click()}>
            {file ? tc("chooseAnotherFile") : tc("selectFile")}
          </button>
          {file && (
            <button type="button" style={{ ...primaryButton, opacity: loading ? 0.7 : 1 }} disabled={loading} onClick={handleTranslate}>
              {loading ? t("runningButton") : t("runButton")}
            </button>
          )}
        </div>
      </div>

      <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: 22, minHeight: 200 }}>
        {!result && !error && (
          <div style={{ fontSize: 13.5, color: "var(--cs-text-2)", lineHeight: 1.6 }}>
            {loading ? t("loadingResult") : t("emptyResult")}
          </div>
        )}
        {error && <div style={{ fontSize: 13.5, color: "var(--cs-bad)", lineHeight: 1.6 }}>{error}</div>}
        {result && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                {result.originalLanguage} &rarr; {targetLanguage}
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                maxHeight: 260,
                overflowY: "auto",
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "var(--cs-text-2)",
                whiteSpace: "pre-wrap",
                padding: 12,
                border: "1px solid var(--cs-line)",
                borderRadius: 10,
                background: "var(--cs-bg)",
              }}
            >
              {result.translatedText}
            </div>
            {!result.pdfBase64 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--cs-text-2)", lineHeight: 1.5 }}>
                {t("noPdfNotice", { language: targetLanguage })}
              </div>
            )}
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {result.pdfBase64 ? (
                <button type="button" className="hover-text" style={primaryButton} onClick={downloadPdf}>
                  {t("downloadPdf")}
                </button>
              ) : (
                <button type="button" className="hover-text" style={primaryButton} onClick={copyText}>
                  {copied ? tc("copied") : tc("copyText")}
                </button>
              )}
              <button
                type="button"
                style={secondaryButton}
                onClick={() => {
                  pickFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                {t("resetButton")}
              </button>
            </div>
          </>
        )}
      </div>

      <AIUsageLimitModal open={limit !== null} onClose={() => setLimit(null)} limit={limit ?? 5} />
    </>
  );
}

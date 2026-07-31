"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AIUsageLimitModal } from "@/components/billing/ai-usage-limit-modal";
import { track } from "@/lib/analytics";

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

export function SummarizeTool() {
  const t = useTranslations("aiTool.summarize");
  const tc = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ summary: string[]; pages: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);

  function pickFile(next: File | null) {
    setFile(next);
    setResult(null);
    setError("");
  }

  async function handleSummarize() {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ai/summarize", { method: "POST", body: formData });
      const data = await res.json();

      if (res.status === 429) {
        setLimit(data.limit ?? 5);
        track("quota_limit_reached", { feature: "summarize", plan: data.plan ?? "free" });
        return;
      }
      if (!res.ok) {
        setError(data.error || tc("error"));
        return;
      }

      setResult({ summary: data.summary, pages: data.pages });
      track("ai_feature_used", { feature: "summarize", user_plan: data.plan ?? "free", tokens_used: data.tokensUsed ?? 0 });
    } catch {
      setError(tc("couldntReachServer"));
    } finally {
      setLoading(false);
    }
  }

  function copySummary() {
    if (!result) return;
    navigator.clipboard.writeText(result.summary.map((s) => `• ${s}`).join("\n"));
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
            <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.24"></path>
            <path d="M12 21v-8"></path>
            <path d="M8 17l4-4 4 4"></path>
          </svg>
        </div>
        <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: "-.025em", overflowWrap: "anywhere" }}>
          {file ? file.name : t("dropHeading")}
        </div>
        <div style={{ maxWidth: 260, fontSize: 13.5, lineHeight: 1.5, color: "var(--cs-text-2)" }}>
          {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : t("idleSubtext")}
        </div>
        <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="hover-text" style={file ? secondaryButton : primaryButton} onClick={() => inputRef.current?.click()}>
            {file ? tc("chooseAnotherFile") : tc("selectFile")}
          </button>
          {file && (
            <button type="button" style={{ ...primaryButton, opacity: loading ? 0.7 : 1 }} disabled={loading} onClick={handleSummarize}>
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
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t("resultHeading")} &middot; {file?.name}</div>
              <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--cs-text-2)" }}>{tc("pagesCount", { count: result.pages })}</div>
            </div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 13 }}>
              {result.summary.map((point, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.55 }}>
                  <span
                    style={{
                      flex: "none",
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: "var(--cs-accent-soft)",
                      color: "var(--cs-accent)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="hover-text" style={primaryButton} onClick={copySummary}>
                {copied ? tc("copied") : tc("copyText")}
              </button>
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

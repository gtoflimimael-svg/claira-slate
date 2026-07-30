"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { AIUsageLimitModal } from "@/components/billing/ai-usage-limit-modal";
import { track } from "@/lib/analytics";

interface OcrResult {
  text: string;
  pages: number;
  pdfBase64: string;
}

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

export function OcrTool() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);

  function pickFile(next: File | null) {
    setFile(next);
    setResult(null);
    setError("");
  }

  async function handleRun() {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ai/ocr", { method: "POST", body: formData });
      const data = await res.json();

      if (res.status === 401) {
        router.push("/login?redirect=/ai/ocr");
        return;
      }
      if (res.status === 429) {
        setLimit(data.limit ?? 5);
        track("quota_limit_reached", { feature: "ocr", plan: data.plan ?? "free" });
        return;
      }
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setResult(data);
      track("ai_feature_used", { feature: "ocr", user_plan: data.plan ?? "free", tokens_used: data.tokensUsed ?? 0 });
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function downloadPdf() {
    if (!result) return;
    const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(file?.name ?? "document").replace(/\.pdf$/i, "")}-searchable.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    track("file_downloaded", { tool_name: "ocr" });
  }

  function copyText() {
    if (!result) return;
    navigator.clipboard.writeText(result.text);
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
            <path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 12h8"></path>
          </svg>
        </div>
        <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: "-.025em", overflowWrap: "anywhere" }}>
          {file ? file.name : "Drop a scanned PDF"}
        </div>
        <div style={{ maxWidth: 260, fontSize: 13.5, lineHeight: 1.5, color: "var(--cs-text-2)" }}>
          {loading ? "Running OCR on every page — this can take a moment…" : "Works best on clear, upright scans"}
        </div>
        <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="hover-text" style={file ? secondaryButton : primaryButton} onClick={() => inputRef.current?.click()}>
            {file ? "Choose a different file" : "Select file"}
          </button>
          {file && (
            <button type="button" style={{ ...primaryButton, opacity: loading ? 0.7 : 1 }} disabled={loading} onClick={handleRun}>
              {loading ? "Running OCR…" : "Run OCR"}
            </button>
          )}
        </div>
      </div>

      <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: 22, minHeight: 200 }}>
        {!result && !error && (
          <div style={{ fontSize: 13.5, color: "var(--cs-text-2)", lineHeight: 1.6 }}>
            {loading ? "Reading each page and cleaning up the text…" : "Upload a scanned PDF and click Run OCR to make it searchable."}
          </div>
        )}
        {error && <div style={{ fontSize: 13.5, color: "var(--cs-bad)", lineHeight: 1.6 }}>{error}</div>}
        {result && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Extracted text</div>
              <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--cs-text-2)" }}>{result.pages} pages</div>
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
              {result.text}
            </div>
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="hover-text" style={primaryButton} onClick={downloadPdf}>
                Download searchable PDF
              </button>
              <button type="button" style={secondaryButton} onClick={copyText}>
                {copied ? "Copied!" : "Copy text"}
              </button>
            </div>
          </>
        )}
      </div>

      <AIUsageLimitModal open={limit !== null} onClose={() => setLimit(null)} limit={limit ?? 5} />
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { AIUsageLimitModal } from "@/components/billing/ai-usage-limit-modal";
import { track } from "@/lib/analytics";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
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

export function ChatTool() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [pdfText, setPdfText] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);

  async function handleFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setExtractError("");
    setExtracting(true);

    try {
      const formData = new FormData();
      formData.append("file", next);
      const res = await fetch("/api/ai/extract-text", { method: "POST", body: formData });
      const data = await res.json();

      if (res.status === 401) {
        router.push("/login?redirect=/ai/chat");
        return;
      }
      if (!res.ok) {
        setExtractError(data.error || "Couldn't read that PDF.");
        setFile(null);
        return;
      }

      setPdfText(data.text);
      setPages(data.pages);
      setMessages([]);
    } catch {
      setExtractError("Couldn't reach the server. Try again.");
      setFile(null);
    } finally {
      setExtracting(false);
    }
  }

  async function handleSend() {
    const trimmed = question.trim();
    if (!trimmed || !pdfText || sending) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuestion("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, pdfText, history }),
      });
      const data = await res.json();

      if (res.status === 401) {
        router.push("/login?redirect=/ai/chat");
        return;
      }
      if (res.status === 429) {
        setLimit(data.limit ?? 5);
        setMessages((prev) => prev.slice(0, -1));
        track("quota_limit_reached", { feature: "chat", plan: data.plan ?? "free" });
        return;
      }
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || "Something went wrong." }]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, citations: data.citations }]);
      track("ai_feature_used", { feature: "chat", user_plan: data.plan ?? "free", tokens_used: data.tokensUsed ?? 0 });
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Couldn't reach the server. Try again." }]);
    } finally {
      setSending(false);
    }
  }

  if (!pdfText) {
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
            if (dropped) handleFile(dropped);
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
              <path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"></path>
            </svg>
          </div>
          <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: "-.025em", overflowWrap: "anywhere" }}>
            {file ? file.name : "Drop a PDF to chat with it"}
          </div>
          <div style={{ maxWidth: 260, fontSize: 13.5, lineHeight: 1.5, color: "var(--cs-text-2)" }}>
            {extracting ? "Reading your document…" : "Up to 300 pages"}
          </div>
          <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="hover-text" style={primaryButton} disabled={extracting} onClick={() => inputRef.current?.click()}>
            {extracting ? "Reading…" : "Select file"}
          </button>
        </div>
        <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: 22, minHeight: 200 }}>
          <div style={{ fontSize: 13.5, color: extractError ? "var(--cs-bad)" : "var(--cs-text-2)", lineHeight: 1.6 }}>
            {extractError || "Upload a PDF to start asking it questions."}
          </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ gridColumn: "1 / -1", border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", display: "flex", flexDirection: "column", height: 560 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--cs-line)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          <span style={{ fontSize: 11.5, color: "var(--cs-text-2)" }}>{pages} pages</span>
          <button
            type="button"
            style={{ ...secondaryButton, padding: "6px 11px", fontSize: 12 }}
            onClick={() => {
              setPdfText(null);
              setFile(null);
              setMessages([]);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            New file
          </button>
        </div>
      </div>

      <div style={{ flex: "1 1 auto", overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 13.5, color: "var(--cs-text-2)" }}>Ask anything about this document — answers are grounded only in its content.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontSize: 13.5,
                lineHeight: 1.55,
                background: m.role === "user" ? "var(--cs-accent)" : "var(--cs-bg-2)",
                color: m.role === "user" ? "#fff" : "var(--cs-text)",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
            {m.citations && m.citations.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {m.citations.map((c, ci) => (
                  <span
                    key={ci}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 99,
                      background: "color-mix(in oklab, #8b5cf6 16%, transparent)",
                      border: "1px solid color-mix(in oklab, #8b5cf6 40%, transparent)",
                      color: "#8b5cf6",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>Thinking…</div>}
      </div>

      <div style={{ display: "flex", gap: 8, padding: 14, borderTop: "1px solid var(--cs-line)" }}>
        <input
          className="cs-field"
          type="text"
          placeholder="Ask a question about this document…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          style={{
            flex: "1 1 auto",
            padding: "11px 14px",
            border: "1px solid var(--cs-line)",
            borderRadius: 10,
            background: "var(--cs-bg)",
            color: "var(--cs-text)",
            fontFamily: "inherit",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button type="button" style={{ ...primaryButton, padding: "0 20px", opacity: sending || !question.trim() ? 0.6 : 1 }} disabled={sending || !question.trim()} onClick={handleSend}>
          Send
        </button>
      </div>

      <AIUsageLimitModal open={limit !== null} onClose={() => setLimit(null)} limit={limit ?? 5} />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { useToolHistory } from "@/components/tools/shared/use-tool-history";
import { PageThumbnailGrid, type PageState } from "@/components/tools/split/page-thumbnail-grid";

type Mode = "single" | "per-page";
type Phase = "idle" | "uploading" | "processing" | "success";

interface OutputFile {
  filename: string;
  r2Key: string;
  downloadUrl: string;
  size: number;
  pages: number;
}

interface ExtractResult {
  files: OutputFile[];
  zip: { downloadUrl: string; r2Key: string; filename: string } | null;
  originalPages: number | null;
  loggedIn: boolean;
}

const inputStyle: CSSProperties = {
  padding: "9px 10px",
  border: "1px solid var(--cs-line)",
  borderRadius: 8,
  background: "var(--cs-bg)",
  color: "var(--cs-text)",
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
  width: "100%",
};

const ghostButton: CSSProperties = {
  padding: "9px 14px",
  borderRadius: 9,
  border: "1.5px solid var(--cs-accent-line)",
  background: "transparent",
  color: "var(--cs-accent)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const smallButton: CSSProperties = {
  padding: "7px 11px",
  borderRadius: 8,
  border: "1px solid var(--cs-line)",
  background: "transparent",
  color: "var(--cs-text)",
  fontSize: 12.5,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const bigActionButton: CSSProperties = {
  width: "100%",
  height: 52,
  border: "none",
  borderRadius: 12,
  background: "var(--cs-grad)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

function parsePagesInput(text: string, total: number): number[] {
  const set = new Set<number>();
  for (const part of text.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(total, parseInt(rangeMatch[2], 10));
      for (let i = start; i <= end; i++) set.add(i);
    } else {
      const n = parseInt(trimmed, 10);
      if (Number.isFinite(n) && n >= 1 && n <= total) set.add(n);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function pagesToRangeString(pages: number[]): string {
  if (pages.length === 0) return "";
  const sorted = [...pages].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  return parts.join(",");
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function ExtractTool() {
  const t = useTranslations("extractTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);
  const lastClickedRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageTextCacheRef = useRef<Map<number, string> | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const history = useToolHistory<Set<number>>(new Set());
  const selectedPages = history.state;
  const [pagesInputText, setPagesInputText] = useState("");
  const [mode, setMode] = useState<Mode>("single");
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUpgradeLimit, setAiUpgradeLimit] = useState<number | null>(null);
  const [aiBanner, setAiBanner] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = resultDeadline ? Math.max(0, Math.round((resultDeadline - now) / 1000)) : 3600;

  useEffect(() => {
    if (!resultDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resultDeadline]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setTotalPages(null);
    history.reset(new Set());
    setPagesInputText("");
    setResult(null);
    setError("");
    setPhase("idle");
    setAiBanner(null);
    setAiError(null);
    setAiUpgradeLimit(null);
    pageTextCacheRef.current = null;
  }

  function handleTotalPages(n: number) {
    setTotalPages(n);
  }

  const avgPageBytes = file && totalPages ? file.size / totalPages : 0;
  const estimatedBytes = avgPageBytes * selectedPages.size;

  function getPageState(pageNum: number): PageState {
    const isSelected = selectedPages.has(pageNum);
    return { selected: isSelected, borderColor: isSelected ? "var(--cs-ok)" : undefined, checkColor: "var(--cs-ok)", dimmed: !isSelected };
  }

  // Reads `selectedPages` from the surrounding closure rather than the
  // updater-function form of setState — same reasoning as split-tool.tsx's
  // handlePageClick: an impure updater would see its own lastClickedRef
  // mutation replayed by React 19's dev-mode double-invoke.
  function handlePageClick(pageNum: number, modifiers: { ctrlKey: boolean; shiftKey: boolean }) {
    const next = new Set(selectedPages);
    if (modifiers.shiftKey && lastClickedRef.current != null) {
      const [lo, hi] = [lastClickedRef.current, pageNum].sort((a, b) => a - b);
      for (let p = lo; p <= hi; p++) next.add(p);
    } else if (modifiers.ctrlKey) {
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
    } else {
      if (next.size === 1 && next.has(pageNum)) next.delete(pageNum);
      else {
        next.clear();
        next.add(pageNum);
      }
    }
    lastClickedRef.current = pageNum;
    history.commit(next);
    setPagesInputText(pagesToRangeString([...next]));
  }

  function handlePagesInputChange(text: string) {
    setPagesInputText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      history.commit(new Set(parsePagesInput(text, totalPages ?? 0)));
    }, 300);
  }

  function selectAll() {
    if (!totalPages) return;
    const next = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    history.commit(next);
    setPagesInputText(pagesToRangeString([...next]));
  }

  function clearAll() {
    history.commit(new Set());
    setPagesInputText("");
  }

  // --- Keyboard shortcuts -----------------------------------------------
  useEffect(() => {
    if (phase !== "idle" || !file) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        history.redo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        history.redo();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        history.undo();
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
      } else if (e.key === "Escape") {
        clearAll();
      } else if (e.key === "Enter" && selectedPages.size > 0) {
        e.preventDefault();
        handleExtract();
      } else if (e.key === "?") {
        setShowShortcuts((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, file, selectedPages, totalPages]);

  // --- AI Extract ---------------------------------------------------------
  async function ensurePageTexts(): Promise<{ pageNumber: number; snippet: string }[]> {
    if (!file) return [];
    if (!pageTextCacheRef.current) {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const cache = new Map<number, string>();
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const snippet = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 500);
          cache.set(i, snippet);
        } catch {
          cache.set(i, "");
        }
      }
      pageTextCacheRef.current = cache;
    }
    return [...pageTextCacheRef.current.entries()].map(([pageNumber, snippet]) => ({ pageNumber, snippet }));
  }

  async function handleAiExtract() {
    if (!file || !totalPages || !aiQuery.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiUpgradeLimit(null);
    setAiBanner(null);
    try {
      const pages = await ensurePageTexts();
      const res = await fetch("/api/ai/extract-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery, pages }),
      });
      const json = await res.json();

      if (res.status === 429) {
        setAiUpgradeLimit(json.limit ?? 5);
        return;
      }
      if (!res.ok) {
        setAiError(json.error || tc("error"));
        return;
      }

      const next = new Set<number>(json.pages as number[]);
      history.commit(next);
      setPagesInputText(pagesToRangeString([...next]));
      setAiBanner(json.reasoning as string);
      track("tool_used", { tool_name: "extract-ai", user_plan: (json.plan as Plan) ?? "free", file_size: 0, success: true });
    } catch {
      setAiError(tc("couldntReachServer"));
    } finally {
      setAiLoading(false);
    }
  }

  // --- Submit -------------------------------------------------------------
  async function handleExtract() {
    if (!file || selectedPages.size === 0) {
      setError(t("noPagesError"));
      return;
    }
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    const config = { pages: [...selectedPages].sort((a, b) => a - b), mode };

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("config", JSON.stringify(config));

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/extract-pages");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
            if (pct >= 100) setPhase("processing");
          }
        };
        xhr.onload = () => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(xhr.responseText);
          } catch {
            parsed = {};
          }
          resolve({ status: xhr.status, json: parsed });
        };
        xhr.onerror = () => reject(new Error("network error"));
        xhr.send(formData);
      });

      if (status === 401) {
        router.push("/login?redirect=/tools/extract-pages");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "extract-pages", plan: (json.plan as Plan) ?? "free" });
        return;
      }
      if (status < 200 || status >= 300) {
        setError((json.error as string) || tc("error"));
        setPhase("idle");
        return;
      }

      setResult({
        files: json.files as OutputFile[],
        zip: json.zip as ExtractResult["zip"],
        originalPages: json.originalPages as number | null,
        loggedIn: !!json.loggedIn,
      });
      setResultDeadline(Date.now() + 3600_000);
      setNow(Date.now());
      setPhase("success");
      track("tool_used", {
        tool_name: "extract-pages",
        user_plan: (json.plan as Plan) ?? "free",
        file_size: file.size,
        success: true,
      });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setResultDeadline(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const extractLabel = useMemo(() => {
    if (phase === "uploading") return tp("uploadingFiles", { count: 1 });
    if (phase === "processing") return tp("processingHeadline");
    return t("extractButton");
  }, [phase, t, tp]);

  // --- Empty state ----------------------------------------------------------
  if (!file) {
    return (
      <div className="split-workspace">
        <div
          style={{
            border: "1.5px dashed var(--cs-accent-line)",
            borderRadius: 20,
            background: "var(--cs-accent-soft)",
            padding: "clamp(28px,4vw,44px) 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 14,
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600 }}>{tp("dropFileHere")}</div>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="hover-text" style={bigActionButton} onClick={() => inputRef.current?.click()}>
            {tc("selectFile")}
          </button>
        </div>
        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: "10px 22px", justifyContent: "center", fontSize: 12.5, color: "var(--cs-text-2)" }}>
          <span>🔒 {tp("trustDeleted")}</span>
          <span>✓ {tp("trustNoAccount")}</span>
          <span>⚡ {tp("trustFast")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="split-workspace">
      <div className="split-columns">
        {/* LEFT: page grid */}
        <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: "clamp(18px,2.5vw,26px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{file.name}</div>
            <button type="button" style={{ ...smallButton, padding: "6px 12px", fontSize: 12.5 }} onClick={reset} disabled={phase !== "idle" && phase !== "success"}>
              {tc("chooseAnotherFile")}
            </button>
          </div>

          <PageThumbnailGrid key={`${file.name}-${file.size}-${file.lastModified}`} file={file} getPageState={getPageState} onPageClick={handlePageClick} onTotalPages={handleTotalPages} />

          <div style={{ marginTop: 14, fontSize: 12, color: "var(--cs-text-2)", textAlign: "center" }}>{t("shortcutsHint")}</div>
        </div>

        {/* RIGHT: config panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {phase === "success" && result ? (
            <ResultPanel result={result} secondsLeft={secondsLeft} onReset={reset} t={t} />
          ) : (
            <>
              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["single", "per-page"] as Mode[]).map((m) => {
                    const modeKey = m === "single" ? "single" : "perPage";
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 20,
                          border: "1px solid " + (mode === m ? "var(--cs-accent)" : "var(--cs-line)"),
                          background: mode === m ? "var(--cs-accent-soft)" : "transparent",
                          color: mode === m ? "var(--cs-accent)" : "var(--cs-text-2)",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {t(`mode.${modeKey}`)}
                      </button>
                    );
                  })}
                </div>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)" }}>
                  {t("pagesToExtractLabel")}
                  <input type="text" placeholder={t("pagesToExtractPlaceholder")} value={pagesInputText} onChange={(e) => handlePagesInputChange(e.target.value)} style={inputStyle} />
                </label>

                <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>
                  {t("pagesSelectedCount", { count: selectedPages.size })}
                  {selectedPages.size > 0 && totalPages ? ` · ~${formatBytes(estimatedBytes)}` : ""}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button type="button" style={smallButton} onClick={selectAll}>
                    {t("selectAll")}
                  </button>
                  <button type="button" style={smallButton} onClick={clearAll}>
                    {t("clearAll")}
                  </button>
                  <button type="button" style={{ ...smallButton, opacity: history.canUndo ? 1 : 0.4 }} onClick={history.undo} disabled={!history.canUndo} title="Ctrl+Z">
                    ↩
                  </button>
                  <button type="button" style={{ ...smallButton, opacity: history.canRedo ? 1 : 0.4 }} onClick={history.redo} disabled={!history.canRedo} title="Ctrl+Shift+Z">
                    ↪
                  </button>
                  <button type="button" style={smallButton} onClick={() => setShowShortcuts((v) => !v)}>
                    ?
                  </button>
                </div>
                {showShortcuts && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: 10, borderRadius: 10, background: "var(--cs-bg-2)", fontSize: 11.5, color: "var(--cs-text-2)" }}>
                    <div>Ctrl+A — {t("selectAll")}</div>
                    <div>Esc — {t("clearAll")}</div>
                    <div>Ctrl+Z / Ctrl+Shift+Z — {t("undo")} / {t("redo")}</div>
                    <div>Enter — {t("extractButton")}</div>
                  </div>
                )}
              </div>

              <div style={{ border: "1px solid var(--cs-accent-line)", borderRadius: 16, background: "var(--cs-accent-soft)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cs-text)" }}>✨ {t("aiExtractHeading")}</div>
                <input type="text" placeholder={t("aiQueryPlaceholder")} value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} style={inputStyle} />
                <button type="button" style={{ ...smallButton, justifyContent: "center", borderColor: "var(--cs-accent)", color: "var(--cs-accent)", fontWeight: 600 }} onClick={handleAiExtract} disabled={aiLoading || !aiQuery.trim()}>
                  {aiLoading ? t("aiExtracting") : t("aiExtractButton")}
                  <span style={{ padding: "1px 6px", borderRadius: 6, background: "var(--cs-accent)", color: "#fff", fontSize: 9.5, fontWeight: 700 }}>PRO</span>
                </button>
                {aiBanner && <div style={{ fontSize: 12, color: "var(--cs-text)" }}>{aiBanner}</div>}
                {aiError && <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{aiError}</div>}
                {aiUpgradeLimit !== null && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12 }}>{t("aiQuotaMessage", { limit: aiUpgradeLimit })}</div>
                    <Link href="/pricing" style={{ padding: "8px 14px", borderRadius: 8, background: "var(--cs-accent)", color: "#fff", fontSize: 12.5, fontWeight: 500, textDecoration: "none", textAlign: "center" }}>
                      {t("upgrade")}
                    </Link>
                  </div>
                )}
              </div>

              {phase === "uploading" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--cs-text-2)" }}>
                    <span>{tp("uploadingFiles", { count: 1 })}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: "var(--cs-line)", overflow: "hidden" }}>
                    <div className="cs-progress-fill" style={{ height: "100%", width: `${uploadProgress}%`, background: "var(--cs-grad)", borderRadius: 99 }} />
                  </div>
                </div>
              )}
              {phase === "processing" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", padding: "8px 0" }}>
                  <div className="cs-spinner" />
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tp("processingHeadline")}</div>
                </div>
              )}

              {phase === "idle" && (
                <button type="button" style={bigActionButton} onClick={handleExtract} disabled={selectedPages.size === 0}>
                  {extractLabel} &rarr;
                </button>
              )}

              {error && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-card)", padding: 14 }}>
                  <span style={{ fontSize: 17 }}>⚠️</span>
                  <div style={{ fontSize: 13, color: "var(--cs-text)" }}>{error}</div>
                </div>
              )}
              {limit !== null && (
                <div style={{ padding: 16, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-accent-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13 }}>{tp("quotaMessage", { limit: limit ?? 5 })}</div>
                  <Link href="/pricing" style={{ padding: "9px 16px", borderRadius: 9, background: "var(--cs-accent)", color: "#fff", fontSize: 13, fontWeight: 500, textDecoration: "none", textAlign: "center" }}>
                    {tp("upgrade")}
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: "10px 22px", justifyContent: "center", fontSize: 12.5, color: "var(--cs-text-2)" }}>
        <span>🔒 {tp("trustDeleted")}</span>
        <span>✓ {tp("trustNoAccount")}</span>
        <span>⚡ {tp("trustFast")}</span>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  secondsLeft,
  onReset,
  t,
}: {
  result: ExtractResult;
  secondsLeft: number;
  onReset: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");

  return (
    <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center", flex: "none" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </motion.div>
        <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 17, fontWeight: 600 }}>{t("resultHeadline")}</div>
      </div>

      {result.zip && (
        <button type="button" className="hover-text" style={bigActionButton} onClick={() => (window.location.href = result.zip!.downloadUrl)}>
          {t("downloadZip")} &darr;
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
        {result.files.map((f) => (
          <div key={f.r2Key} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, border: "1px solid var(--cs-line)" }}>
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</div>
              <div style={{ fontSize: 11, color: "var(--cs-text-2)" }}>
                {f.pages} p. &middot; {formatBytes(f.size)}
              </div>
            </div>
            <a href={f.downloadUrl} style={{ flex: "none", padding: "7px 12px", borderRadius: 8, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 12, fontWeight: 500, textDecoration: "none", cursor: "pointer" }}>
              {tc("download")}
            </a>
          </div>
        ))}
      </div>

      <button type="button" style={ghostButton} onClick={onReset}>
        {t("extractAgain")}
      </button>

      <div style={{ fontSize: 12, color: "var(--cs-text-2)", textAlign: "center" }}>🕐 {tp("fileDeletedIn", { time: formatCountdown(secondsLeft) })}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", fontSize: 11.5, color: "var(--cs-text-2)", paddingTop: 8, borderTop: "1px solid var(--cs-line)" }}>
        <span>🔒 {tp("trustEncrypted")}</span>
        <span>✓ {tai("trustNeverTraining")}</span>
      </div>

      {!result.loggedIn && (
        <Link
          href="/signup"
          style={{ display: "block", padding: "10px 14px", borderRadius: 10, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", color: "var(--cs-text)", fontSize: 12.5, lineHeight: 1.5, textDecoration: "none" }}
        >
          {tp("loginNudge")} &rarr;
        </Link>
      )}
    </div>
  );
}

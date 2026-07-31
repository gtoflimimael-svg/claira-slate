"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { useToolHistory } from "@/components/tools/shared/use-tool-history";
import { PageThumbnailGrid, type PageState } from "@/components/tools/split/page-thumbnail-grid";

type Phase = "idle" | "uploading" | "processing" | "success";

// Deliberately red, not the app's violet accent — marking a page here means
// "this will be deleted," a distinct and more consequential action than the
// violet "selected" state used by Split/Extract.
const DELETE_RED = "#EF4444";

interface DeleteResult {
  downloadUrl: string;
  filename: string;
  size: number;
  pages: number;
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

const dangerButton: CSSProperties = {
  width: "100%",
  height: 52,
  border: "none",
  borderRadius: 12,
  background: `linear-gradient(135deg, ${DELETE_RED}, #dc2626)`,
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

const bigActionButton: CSSProperties = {
  width: "100%",
  height: 56,
  border: "none",
  borderRadius: 12,
  background: "var(--cs-grad)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function DeleteTool() {
  const t = useTranslations("deleteTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);
  const lastClickedRef = useRef<number | null>(null);
  const pageTextCacheRef = useRef<Map<number, string> | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const history = useToolHistory<Set<number>>(new Set());
  const marked = history.state;
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "markAll" | "delete"; onConfirm: () => void } | null>(null);
  const [blankScanning, setBlankScanning] = useState(false);

  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUpgradeLimit, setAiUpgradeLimit] = useState<number | null>(null);
  const [aiBanner, setAiBanner] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<DeleteResult | null>(null);
  const [processingSeconds, setProcessingSeconds] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = resultDeadline ? Math.max(0, Math.round((resultDeadline - now) / 1000)) : 3600;

  const willDeleteEverything = totalPages !== null && marked.size >= totalPages && totalPages > 0;

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

  function getPageState(pageNum: number): PageState {
    const isMarked = marked.has(pageNum);
    return { selected: isMarked, borderColor: isMarked ? DELETE_RED : undefined, checkColor: DELETE_RED, dimmed: isMarked };
  }

  // Unlike Extract's "keep" selection (plain click replaces the selection —
  // suited to picking one contiguous range at a time), Delete's mental model
  // is scattered individual pages: plain click toggles just that page,
  // shift-click extends a mark-range from the last click, without touching
  // any other page's mark state.
  function handlePageClick(pageNum: number, modifiers: { ctrlKey: boolean; shiftKey: boolean }) {
    const next = new Set(marked);
    if (modifiers.shiftKey && lastClickedRef.current != null) {
      const [lo, hi] = [lastClickedRef.current, pageNum].sort((a, b) => a - b);
      for (let p = lo; p <= hi; p++) next.add(p);
    } else {
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
    }
    lastClickedRef.current = pageNum;
    history.commit(next);
  }

  function clearSelection() {
    history.commit(new Set());
  }

  function markAll() {
    if (!totalPages) return;
    setConfirm({
      kind: "markAll",
      onConfirm: () => {
        history.commit(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
        setConfirm(null);
      },
    });
  }

  function markFirst() {
    if (!totalPages) return;
    history.commit(new Set(marked).add(1));
  }

  function markLast() {
    if (!totalPages) return;
    history.commit(new Set(marked).add(totalPages));
  }

  async function ensurePageTexts(): Promise<Map<number, string>> {
    if (pageTextCacheRef.current) return pageTextCacheRef.current;
    if (!file) return new Map();
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
          .trim();
        cache.set(i, snippet);
      } catch {
        cache.set(i, "");
      }
    }
    pageTextCacheRef.current = cache;
    return cache;
  }

  async function markBlankPages() {
    if (!file || !totalPages) return;
    setBlankScanning(true);
    try {
      const texts = await ensurePageTexts();
      const next = new Set(marked);
      for (const [pageNum, text] of texts) {
        if (text.length === 0) next.add(pageNum);
      }
      history.commit(next);
    } finally {
      setBlankScanning(false);
    }
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
        markAll();
      } else if (e.key === "Escape") {
        clearSelection();
      } else if ((e.key === "Enter" || e.key === "Delete" || e.key === "Backspace") && marked.size > 0) {
        e.preventDefault();
        requestDelete();
      } else if (e.key === "?") {
        setShowShortcuts((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, file, marked, totalPages]);

  // --- AI Delete ------------------------------------------------------------
  async function handleAiDelete() {
    if (!file || !totalPages || !aiQuery.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiUpgradeLimit(null);
    setAiBanner(null);
    try {
      const texts = await ensurePageTexts();
      const pages = [...texts.entries()].map(([pageNumber, snippet]) => ({ pageNumber, snippet: snippet.slice(0, 500) }));
      const res = await fetch("/api/ai/delete-suggest", {
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
      setAiBanner(json.reasoning as string);
      track("tool_used", { tool_name: "delete-ai", user_plan: (json.plan as Plan) ?? "free", file_size: 0, success: true });
    } catch {
      setAiError(tc("couldntReachServer"));
    } finally {
      setAiLoading(false);
    }
  }

  // --- Submit -------------------------------------------------------------
  function requestDelete() {
    if (!file || marked.size === 0 || !totalPages) return;
    if (willDeleteEverything) {
      setError(t("cantDeleteAllError"));
      return;
    }
    setConfirm({ kind: "delete", onConfirm: () => { setConfirm(null); handleDelete(); } });
  }

  async function handleDelete() {
    if (!file || marked.size === 0) return;
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    const config = { pagesToDelete: [...marked].sort((a, b) => a - b) };

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("config", JSON.stringify(config));

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/delete-pages");
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
        router.push("/login?redirect=/tools/delete-pages");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "delete-pages", plan: (json.plan as Plan) ?? "free" });
        return;
      }
      if (status < 200 || status >= 300) {
        setError((json.error as string) || tc("error"));
        setPhase("idle");
        return;
      }

      setProcessingSeconds((Date.now() - startTimeRef.current) / 1000);
      setResult({
        downloadUrl: json.downloadUrl as string,
        filename: json.filename as string,
        size: (json.size as number) ?? 0,
        pages: (json.pages as number) ?? 0,
        loggedIn: !!json.loggedIn,
      });
      setNow(Date.now());
      setResultDeadline(Date.now() + 3600_000);
      setPhase("success");
      track("tool_used", {
        tool_name: "delete-pages",
        user_plan: (json.plan as Plan) ?? "free",
        file_size: file.size,
        success: true,
      });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: "delete-pages" });
  }

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setResultDeadline(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const deleteLabel = useMemo(() => {
    if (phase === "uploading") return tp("uploadingFiles", { count: 1 });
    if (phase === "processing") return tp("processingHeadline");
    return t("deleteButton", { count: marked.size });
  }, [phase, marked.size, t, tp]);

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
          {phase === "success" && result && totalPages ? (
            <ResultPanel
              result={result}
              originalFile={file}
              deletedCount={marked.size}
              secondsLeft={secondsLeft}
              processingSeconds={processingSeconds}
              downloaded={downloaded}
              onDownload={handleDownload}
              onReset={reset}
              t={t}
            />
          ) : (
            <>
              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" }}>{t("quickActionsHeading")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button type="button" style={smallButton} onClick={markBlankPages} disabled={blankScanning}>
                    {blankScanning ? t("scanning") : t("deleteBlankPages")}
                  </button>
                  <button type="button" style={smallButton} onClick={markFirst}>
                    {t("deleteFirstPage")}
                  </button>
                  <button type="button" style={smallButton} onClick={markLast}>
                    {t("deleteLastPage")}
                  </button>
                  <button type="button" style={smallButton} onClick={clearSelection}>
                    {t("clearSelection")}
                  </button>
                </div>

                <div style={{ fontSize: 12.5, fontWeight: 600, color: marked.size > 0 ? DELETE_RED : "var(--cs-text-2)" }}>
                  {t("markedCount", { count: marked.size })}
                </div>
                {willDeleteEverything && <div style={{ fontSize: 12, color: DELETE_RED }}>{t("cantDeleteAllWarning")}</div>}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button type="button" style={smallButton} onClick={markAll}>
                    {t("markAll")}
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
                    <div>{t("shortcutClick")}</div>
                    <div>Ctrl+A — {t("markAll")}</div>
                    <div>Esc — {t("clearSelection")}</div>
                    <div>
                      Ctrl+Z / Ctrl+Shift+Z — {t("undo")} / {t("redo")}
                    </div>
                    <div>Enter / Del — {t("deleteButton", { count: marked.size })}</div>
                  </div>
                )}
              </div>

              <div style={{ border: "1px solid var(--cs-accent-line)", borderRadius: 16, background: "var(--cs-accent-soft)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cs-text)" }}>✨ {t("aiDeleteHeading")}</div>
                <input type="text" placeholder={t("aiQueryPlaceholder")} value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} style={inputStyle} />
                <button type="button" style={{ ...smallButton, justifyContent: "center", borderColor: "var(--cs-accent)", color: "var(--cs-accent)", fontWeight: 600 }} onClick={handleAiDelete} disabled={aiLoading || !aiQuery.trim()}>
                  {aiLoading ? t("aiAnalyzing") : t("aiDeleteButton")}
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
                    <div className="cs-progress-fill" style={{ height: "100%", width: `${uploadProgress}%`, background: DELETE_RED, borderRadius: 99 }} />
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
                <button
                  type="button"
                  style={{ ...dangerButton, opacity: marked.size === 0 || willDeleteEverything ? 0.5 : 1, cursor: marked.size === 0 || willDeleteEverything ? "not-allowed" : "pointer" }}
                  onClick={requestDelete}
                  disabled={marked.size === 0 || willDeleteEverything}
                >
                  {deleteLabel} &rarr;
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

      {confirm && (
        <ConfirmModal
          title={confirm.kind === "markAll" ? t("confirmMarkAllTitle") : t("confirmDeleteTitle")}
          body={
            confirm.kind === "markAll"
              ? t("confirmMarkAllBody", { count: totalPages ?? 0 })
              : t("confirmDeleteBody", { count: marked.size, remaining: (totalPages ?? 0) - marked.size })
          }
          confirmLabel={confirm.kind === "markAll" ? t("markAll") : t("deleteButton", { count: marked.size })}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const tc = useTranslations("common");
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", padding: 20 }}
      onClick={onCancel}
    >
      <div
        style={{ width: "100%", maxWidth: 380, borderRadius: 16, background: "var(--cs-card)", border: "1px solid var(--cs-line)", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 17, fontWeight: 600, color: DELETE_RED }}>{title}</div>
        <div style={{ fontSize: 13.5, color: "var(--cs-text-2)", lineHeight: 1.5 }}>{body}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={{ ...smallButton, flex: 1, justifyContent: "center" }} onClick={onCancel}>
            {tc("cancel")}
          </button>
          <button type="button" style={{ ...dangerButton, flex: 1, height: 40, fontSize: 13.5 }} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  originalFile,
  deletedCount,
  secondsLeft,
  processingSeconds,
  downloaded,
  onDownload,
  onReset,
  t,
}: {
  result: DeleteResult;
  originalFile: File;
  deletedCount: number;
  secondsLeft: number;
  processingSeconds: number | null;
  downloaded: boolean;
  onDownload: () => void;
  onReset: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");

  const pctChange = originalFile.size > 0 ? Math.round((1 - result.size / originalFile.size) * 100) : 0;

  return (
    <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center", flex: "none" }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      </motion.div>
      <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600 }}>{t("resultHeadline", { count: deletedCount })}</div>
      <div style={{ fontSize: 13.5, color: "var(--cs-text-2)" }}>{t("resultPageCount", { count: result.pages })}</div>

      <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>
        <div style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{result.filename}</div>
        <div style={{ marginTop: 3 }}>
          {t("sizeComparison", { before: formatBytes(originalFile.size), after: formatBytes(result.size), pct: pctChange })}
        </div>
        {processingSeconds !== null && <div style={{ marginTop: 3 }}>{tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}</div>}
      </div>

      <button type="button" className="hover-text" style={bigActionButton} onClick={onDownload}>
        {downloaded ? tc("downloaded") : tc("download")} &darr;
      </button>
      <button type="button" style={ghostButton} onClick={onReset}>
        {t("deleteMore")}
      </button>

      <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>🕐 {tp("fileDeletedIn", { time: formatCountdown(secondsLeft) })}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", fontSize: 11.5, color: "var(--cs-text-2)", paddingTop: 8, borderTop: "1px solid var(--cs-line)", width: "100%" }}>
        <span>🔒 {tp("trustEncrypted")}</span>
        <span>✓ {tai("trustNeverTraining")}</span>
      </div>

      {!result.loggedIn && (
        <Link
          href="/signup"
          style={{ display: "block", width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", color: "var(--cs-text)", fontSize: 12.5, lineHeight: 1.5, textDecoration: "none" }}
        >
          {tp("loginNudge")} &rarr;
        </Link>
      )}
    </div>
  );
}

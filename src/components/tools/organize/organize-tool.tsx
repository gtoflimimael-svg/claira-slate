"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { FileThumbnail } from "@/components/tools/file-thumbnail";
import { OrganizePageGrid, type OrganizePageGridHandle } from "./organize-page-grid";
import { OrganizePanel } from "./organize-panel";
import { useToolHistory } from "@/components/tools/shared/use-tool-history";
import { SOURCE_COLORS, sourceLabelForIndex, genId, markMoved, isModified, type SourceFile, type OrganizePage } from "./types";

type Phase = "idle" | "uploading" | "processing" | "success";
type View = "grid" | "list";

interface OrganizeResult {
  downloadUrl: string;
  filename: string;
  r2Key: string;
  size: number;
  pages: number | null;
  loggedIn: boolean;
}

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

const ghostButton: CSSProperties = {
  padding: "12px 20px",
  borderRadius: 10,
  border: "1.5px solid var(--cs-line)",
  background: "transparent",
  color: "var(--cs-text)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const toolbarBtn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--cs-line)",
  background: "var(--cs-card)",
  color: "var(--cs-text)",
  fontSize: 12.5,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function newPagesForSource(sourceId: string, pageCount: number): OrganizePage[] {
  return Array.from({ length: pageCount }, (_, i) => ({
    id: genId("pg"),
    sourceId,
    originalIndex: i,
    rotation: 0,
  }));
}

export function OrganizeTool() {
  const t = useTranslations("organizeTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<OrganizePageGridHandle>(null);
  const startTimeRef = useRef(0);
  const lastClickedRef = useRef<string | null>(null);
  const sortDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sources, setSources] = useState<SourceFile[]>([]);
  const history = useToolHistory<OrganizePage[]>([]);
  const pages = history.state;

  const [view, setView] = useState<View>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [spacePreview, setSpacePreview] = useState<{ dataUrl: string; rotation: number } | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUpgradeLimit, setAiUpgradeLimit] = useState<number | null>(null);
  const [aiBanner, setAiBanner] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [processingSeconds, setProcessingSeconds] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = resultDeadline ? Math.max(0, Math.round((resultDeadline - now) / 1000)) : 3600;

  const disabled = phase !== "idle";
  const modifiedCount = pages.filter(isModified).length;

  useEffect(() => {
    if (!resultDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resultDeadline]);

  // Same same-origin-proxy workaround as every other tool's result thumbnail:
  // the R2 bucket has no browser-fetch CORS policy on its presigned URL.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/files/preview?key=${encodeURIComponent(result.r2Key)}`);
        if (!res.ok) return;
        const blob = await res.blob();
        if (!cancelled) setPreviewFile(new File([blob], result.filename, { type: blob.type }));
      } catch {
        // Thumbnail just won't render; download still works via the direct URL.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  // --- File intake ----------------------------------------------------------
  function pickFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (incoming.length === 0) return;
    setSources((prev) => [
      ...prev,
      ...incoming.map((file, i) => ({
        id: genId("src"),
        file,
        color: SOURCE_COLORS[(prev.length + i) % SOURCE_COLORS.length],
        label: sourceLabelForIndex(prev.length + i),
        pageCount: null as number | null,
      })),
    ]);
    setResult(null);
    setPreviewFile(null);
    setError("");
  }

  useEffect(() => {
    if (sources.length > 0) return;
    function onPaste(e: ClipboardEvent) {
      const pastedFiles = e.clipboardData?.files;
      if (pastedFiles && pastedFiles.length > 0) pickFiles(pastedFiles);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [sources.length]);

  // This fires from inside an async pdf.js-load closure that may resolve
  // long after it was created (e.g. two PDFs added in one picker selection,
  // finishing their loads back to back) — using the functional-update form
  // means each call applies against whatever pages exist *at that moment*,
  // instead of racing on a `pages` value captured when the closure was made.
  function handleSourceLoaded(sourceId: string, pageCount: number) {
    setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, pageCount } : s)));
    history.setSilently((prev) => [...prev, ...newPagesForSource(sourceId, pageCount)]);
  }

  function handleRemoveSource(sourceId: string) {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
    const next = pages.filter((p) => p.sourceId !== sourceId);
    history.setSilently(next);
    setSelectedIds((prev) => new Set([...prev].filter((id) => next.some((p) => p.id === id))));
  }

  function handleReorderSources(next: SourceFile[]) {
    setSources(next);
    const grouped = next.flatMap((src) => pages.filter((p) => p.sourceId === src.id));
    history.commit(markMoved(pages, grouped));
  }

  function resetAll() {
    setSources([]);
    history.reset([]);
    setSelectedIds(new Set());
    setFocusedId(null);
    setResult(null);
    setPreviewFile(null);
    setResultDeadline(null);
    setProcessingSeconds(null);
    setDownloaded(false);
    setError("");
    setPhase("idle");
    setAiBanner(null);
    setAiError(null);
    setAiUpgradeLimit(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // --- Selection --------------------------------------------------------
  // Reads `pages`/`selectedIds` from the surrounding closure rather than the
  // updater-function form of setState — same reasoning as split-tool.tsx's
  // handlePageClick: an impure updater would see its own lastClickedRef
  // mutation replayed by React 19's dev-mode double-invoke.
  function handleSelect(id: string, modifiers: { ctrlKey: boolean; shiftKey: boolean }) {
    const next = new Set(selectedIds);
    if (modifiers.shiftKey && lastClickedRef.current) {
      const ids = pages.map((p) => p.id);
      const a = ids.indexOf(lastClickedRef.current);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) next.add(ids[i]);
      }
    } else if (modifiers.ctrlKey) {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    } else {
      if (next.size === 1 && next.has(id)) next.delete(id);
      else {
        next.clear();
        next.add(id);
      }
    }
    lastClickedRef.current = id;
    setSelectedIds(next);
  }

  // --- Page mutations -----------------------------------------------------
  function deletePage(id: string) {
    history.commit(pages.filter((p) => p.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function deleteSelection() {
    const targets = selectedIds.size > 0 ? selectedIds : focusedId ? new Set([focusedId]) : new Set<string>();
    if (targets.size === 0) return;
    history.commit(pages.filter((p) => !targets.has(p.id)));
    setSelectedIds(new Set());
  }

  function rotatePage(id: string, delta: number) {
    history.commit(pages.map((p) => (p.id === id ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 } : p)));
  }

  function rotateSelection(delta: number) {
    const targets = selectedIds.size > 0 ? selectedIds : focusedId ? new Set([focusedId]) : new Set<string>();
    if (targets.size === 0) return;
    history.commit(pages.map((p) => (targets.has(p.id) ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 } : p)));
  }

  function duplicatePage(afterId: string) {
    const idx = pages.findIndex((p) => p.id === afterId);
    if (idx === -1) return;
    const original = pages[idx];
    const copy: OrganizePage = { ...original, id: genId("pg"), duplicatedFrom: original.id, moved: false };
    const next = [...pages.slice(0, idx + 1), copy, ...pages.slice(idx + 1)];
    history.commit(next);
  }

  function duplicateSelection() {
    const targets = selectedIds.size > 0 ? selectedIds : focusedId ? new Set([focusedId]) : new Set<string>();
    if (targets.size === 0) return;
    const next = pages.flatMap((p) =>
      targets.has(p.id) ? [p, { ...p, id: genId("pg"), duplicatedFrom: p.id, moved: false }] : [p]
    );
    history.commit(next);
  }

  function handleReorder(next: OrganizePage[]) {
    history.commit(markMoved(pages, next));
  }

  // --- Sort -----------------------------------------------------------------
  function debouncedCommit(next: OrganizePage[]) {
    if (sortDebounceRef.current) clearTimeout(sortDebounceRef.current);
    sortDebounceRef.current = setTimeout(() => history.commit(markMoved(pages, next)), 300);
  }

  function sortAZ() {
    const orderedSources = [...sources].sort((a, b) => a.file.name.localeCompare(b.file.name));
    debouncedCommit(orderedSources.flatMap((src) => pages.filter((p) => p.sourceId === src.id)));
  }

  function sortNumeric() {
    const seenOrder: string[] = [];
    for (const p of pages) if (!seenOrder.includes(p.sourceId)) seenOrder.push(p.sourceId);
    const next = seenOrder.flatMap((sourceId) =>
      pages.filter((p) => p.sourceId === sourceId).sort((a, b) => a.originalIndex - b.originalIndex)
    );
    debouncedCommit(next);
  }

  function interleave() {
    if (sources.length !== 2) return;
    const [a, b] = sources;
    const aPages = pages.filter((p) => p.sourceId === a.id);
    const bPages = pages.filter((p) => p.sourceId === b.id);
    const next: OrganizePage[] = [];
    const max = Math.max(aPages.length, bPages.length);
    for (let i = 0; i < max; i++) {
      if (aPages[i]) next.push(aPages[i]);
      if (bPages[i]) next.push(bPages[i]);
    }
    debouncedCommit(next);
  }

  function resetToOriginal() {
    const next = sources.flatMap((src) => newPagesForSource(src.id, src.pageCount ?? 0));
    history.reset(next);
    setSelectedIds(new Set());
    setFocusedId(null);
  }

  // --- Keyboard shortcuts -----------------------------------------------
  useEffect(() => {
    if (phase !== "idle" || sources.length === 0) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const ids = pages.map((p) => p.id);
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
        setSelectedIds(new Set(ids));
      } else if (e.key === "Escape") {
        setSelectedIds(new Set());
        setSpacePreview(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      } else if (e.key.toLowerCase() === "r") {
        rotateSelection(e.shiftKey ? -90 : 90);
      } else if (e.key.toLowerCase() === "d") {
        duplicateSelection();
      } else if (e.key === " ") {
        e.preventDefault();
        const page = pages.find((p) => p.id === focusedId);
        if (!page) return;
        const dataUrl = gridRef.current?.getThumbDataUrl(page.sourceId, page.originalIndex);
        setSpacePreview((prev) => (prev ? null : dataUrl ? { dataUrl, rotation: page.rotation } : null));
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        if (ids.length === 0) return;
        const current = focusedId ? ids.indexOf(focusedId) : -1;
        const delta = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
        const nextIndex = current === -1 ? 0 : Math.min(ids.length - 1, Math.max(0, current + delta));
        setFocusedId(ids[nextIndex]);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sources.length, pages, selectedIds, focusedId]);

  // --- AI Organize ------------------------------------------------------
  async function handleAiOrganize() {
    if (pages.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiUpgradeLimit(null);
    setAiBanner(null);
    try {
      const sourceById = new Map(sources.map((s) => [s.id, s]));
      const snippets = await Promise.all(
        pages.map(async (p) => ({
          id: p.id,
          label: `${sourceById.get(p.sourceId)?.label ?? "?"} · p.${p.originalIndex + 1}`,
          snippet: (await gridRef.current?.getPageText(p.sourceId, p.originalIndex)) ?? "",
        }))
      );

      const res = await fetch("/api/ai/organize-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: snippets }),
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

      const byId = new Map(pages.map((p) => [p.id, p]));
      const reordered = (json.order as string[]).map((id) => byId.get(id)).filter((p): p is OrganizePage => !!p);
      if (reordered.length !== pages.length) {
        setAiError(t("aiInvalidOrder"));
        return;
      }
      history.commit(markMoved(pages, reordered));
      setAiBanner(json.reasoning as string);
      track("tool_used", { tool_name: "organize-ai", user_plan: (json.plan as Plan) ?? "free", file_size: 0, success: true });
    } catch {
      setAiError(tc("couldntReachServer"));
    } finally {
      setAiLoading(false);
    }
  }

  // --- Submit -------------------------------------------------------------
  async function handleSubmit() {
    if (pages.length === 0 || sources.some((s) => s.pageCount === null)) return;
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    const fileIndexById = new Map(sources.map((s, i) => [s.id, i]));
    const config = {
      pageOrder: pages.map((p) => ({
        fileIndex: fileIndexById.get(p.sourceId)!,
        pageIndex: p.originalIndex,
        rotation: p.rotation,
      })),
    };

    try {
      const formData = new FormData();
      sources.forEach((s) => formData.append("file", s.file));
      formData.append("config", JSON.stringify(config));

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/organize");
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
        router.push("/login?redirect=/tools/reorder");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "reorder", plan: (json.plan as Plan) ?? "free" });
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
        r2Key: json.r2Key as string,
        size: (json.size as number) ?? 0,
        pages: (json.pages as number) ?? null,
        loggedIn: !!json.loggedIn,
      });
      setNow(Date.now());
      setResultDeadline(Date.now() + 3600_000);
      setPhase("success");
      track("tool_used", {
        tool_name: "reorder",
        user_plan: (json.plan as Plan) ?? "free",
        file_size: sources.reduce((sum, s) => sum + s.file.size, 0),
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
    track("file_downloaded", { tool_name: "reorder" });
  }

  const canInterleave = sources.length === 2;
  const allPagesLoaded = sources.length > 0 && sources.every((s) => s.pageCount !== null);

  const submitLabel = useMemo(() => {
    if (phase === "uploading") return tp("uploadingFiles", { count: sources.length });
    if (phase === "processing") return tp("processingHeadline");
    return t("organizeButton");
  }, [phase, sources.length, t, tp]);

  // --- Empty state ----------------------------------------------------------
  if (sources.length === 0) {
    return (
      <div className="organize-workspace">
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
            pickFiles(e.dataTransfer.files);
          }}
        >
          <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600 }}>{tp("dropFileHere")}</div>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: "none" }} onChange={(e) => pickFiles(e.target.files)} />
          <button type="button" className="hover-text" style={bigActionButton} onClick={() => inputRef.current?.click()}>
            {tc("selectFile")}
          </button>
          <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t("multiUploadHint")}</div>
        </div>
        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: "10px 22px", justifyContent: "center", fontSize: 12.5, color: "var(--cs-text-2)" }}>
          <span>🔒 {tp("trustDeleted")}</span>
          <span>✓ {tp("trustNoAccount")}</span>
          <span>⚡ {tp("trustFast")}</span>
        </div>
      </div>
    );
  }

  // --- Loaded workspace -------------------------------------------------
  return (
    <div className="organize-workspace">
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: "none" }} onChange={(e) => pickFiles(e.target.files)} />

      <div className="organize-toolbar">
        <button type="button" style={toolbarBtn} onClick={() => inputRef.current?.click()} disabled={disabled}>
          + {t("addPdf")}
        </button>
        <button type="button" style={{ ...toolbarBtn, background: view === "grid" ? "var(--cs-accent-soft)" : "var(--cs-card)" }} onClick={() => setView("grid")}>
          ⊞
        </button>
        <button type="button" style={{ ...toolbarBtn, background: view === "list" ? "var(--cs-accent-soft)" : "var(--cs-card)" }} onClick={() => setView("list")}>
          ☰
        </button>
        <button type="button" style={{ ...toolbarBtn, opacity: history.canUndo ? 1 : 0.4 }} onClick={history.undo} disabled={!history.canUndo}>
          ↩
        </button>
        <button type="button" style={{ ...toolbarBtn, opacity: history.canRedo ? 1 : 0.4 }} onClick={history.redo} disabled={!history.canRedo}>
          ↪
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--cs-text-2)", display: "flex", alignItems: "center", gap: 10 }}>
          {t("summaryLine", { pages: pages.length, changes: modifiedCount })}
          {modifiedCount > 0 && (
            <button type="button" className="hover-text" style={{ border: "none", background: "none", color: "var(--cs-accent)", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, padding: 0 }} onClick={resetToOriginal}>
              {t("resetToOriginal")}
            </button>
          )}
        </span>
      </div>

      {selectedIds.size > 0 && (
        <div className="organize-selection-bar">
          <span>{t("pagesSelected", { count: selectedIds.size })}</span>
          <button type="button" style={toolbarBtn} onClick={deleteSelection}>
            {t("deletePage")}
          </button>
          <button type="button" style={toolbarBtn} onClick={() => rotateSelection(90)}>
            {t("rotatePage")}
          </button>
          <button type="button" style={toolbarBtn} onClick={duplicateSelection}>
            {t("duplicatePage")}
          </button>
          <button type="button" style={toolbarBtn} onClick={() => setSelectedIds(new Set())}>
            {t("deselect")}
          </button>
        </div>
      )}

      {aiBanner && (
        <div className="organize-ai-banner">
          <span>✨ {aiBanner}</span>
          <button type="button" style={{ ...toolbarBtn, flex: "none" }} onClick={() => { history.undo(); setAiBanner(null); }}>
            {t("undo")}
          </button>
          <button type="button" style={{ ...toolbarBtn, flex: "none" }} onClick={() => setAiBanner(null)}>
            {t("keep")}
          </button>
        </div>
      )}

      <div className="organize-columns">
        <div className="organize-grid-panel">
          {!allPagesLoaded && <div className="organize-loading-hint">{t("loadingPages")}</div>}
          <OrganizePageGrid
            ref={gridRef}
            sources={sources}
            pages={pages}
            view={view}
            selectedIds={selectedIds}
            focusedId={focusedId}
            disabled={disabled}
            onFocus={setFocusedId}
            onSelect={handleSelect}
            onReorder={handleReorder}
            onDelete={deletePage}
            onRotate={rotatePage}
            onDuplicate={duplicatePage}
            onSourceLoaded={handleSourceLoaded}
          />
          {sources.length > 0 && t("shortcutsHint") && <div style={{ marginTop: 14, fontSize: 12, color: "var(--cs-text-2)", textAlign: "center" }}>{t("shortcutsHint")}</div>}
        </div>

        <div>
          {phase === "success" && result ? (
            <ResultPanel
              result={result}
              previewFile={previewFile}
              secondsLeft={secondsLeft}
              processingSeconds={processingSeconds}
              downloaded={downloaded}
              onDownload={handleDownload}
              onReset={resetAll}
            />
          ) : (
            <OrganizePanel
              sources={sources}
              onAddFiles={() => inputRef.current?.click()}
              onRemoveSource={handleRemoveSource}
              onReorderSources={handleReorderSources}
              onResetAll={resetAll}
              view={view}
              onSetView={setView}
              onSortAZ={sortAZ}
              onSortNumeric={sortNumeric}
              onInterleave={interleave}
              canInterleave={canInterleave}
              onUndo={history.undo}
              onRedo={history.redo}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              onAiOrganize={handleAiOrganize}
              aiLoading={aiLoading}
              aiError={aiError}
              aiUpgradeLimit={aiUpgradeLimit}
              totalPages={pages.length}
              modifiedCount={modifiedCount}
              onResetToOriginal={resetToOriginal}
              onSubmit={handleSubmit}
              submitDisabled={disabled || pages.length === 0 || !allPagesLoaded}
              submitLabel={submitLabel}
            />
          )}

          {phase === "uploading" && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--cs-text-2)" }}>
                <span>{tp("uploadingFiles", { count: sources.length })}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: "var(--cs-line)", overflow: "hidden" }}>
                <div className="cs-progress-fill" style={{ height: "100%", width: `${uploadProgress}%`, background: "var(--cs-grad)", borderRadius: 99 }} />
              </div>
            </div>
          )}
          {phase === "processing" && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              <div className="cs-spinner" />
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tp("processingHeadline")}</div>
            </div>
          )}
          {error && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-card)", padding: 14 }}>
              <span style={{ fontSize: 17 }}>⚠️</span>
              <div style={{ fontSize: 13, color: "var(--cs-text)" }}>{error}</div>
            </div>
          )}
          {limit !== null && (
            <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-accent-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13 }}>{tp("quotaMessage", { limit: limit ?? 5 })}</div>
              <Link href="/pricing" style={{ padding: "9px 16px", borderRadius: 9, background: "var(--cs-accent)", color: "#fff", fontSize: 13, fontWeight: 500, textDecoration: "none", textAlign: "center" }}>
                {tp("upgrade")}
              </Link>
            </div>
          )}
        </div>
      </div>

      {spacePreview && (
        <div className="organize-space-preview" onClick={() => setSpacePreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={spacePreview.dataUrl}
            alt=""
            style={{ transform: `rotate(${spacePreview.rotation}deg)`, maxWidth: "80vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
          />
        </div>
      )}

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
  previewFile,
  secondsLeft,
  processingSeconds,
  downloaded,
  onDownload,
  onReset,
}: {
  result: OrganizeResult;
  previewFile: File | null;
  secondsLeft: number;
  processingSeconds: number | null;
  downloaded: boolean;
  onDownload: () => void;
  onReset: () => void;
}) {
  const t = useTranslations("organizeTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");

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
      <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600 }}>{t("resultHeadline")}</div>

      {previewFile && (
        <div style={{ width: 100, height: 125, borderRadius: 10, overflow: "hidden", background: "var(--cs-bg-2)", border: "1px solid var(--cs-line)" }}>
          <FileThumbnail file={previewFile} isPdf />
        </div>
      )}

      <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>
        <div style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{result.filename}</div>
        <div style={{ marginTop: 3 }}>
          {formatBytes(result.size)}
          {result.pages ? ` · ${result.pages} p.` : ""}
          {processingSeconds !== null && ` · ${tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}`}
        </div>
      </div>

      <button type="button" className="hover-text" style={bigActionButton} onClick={onDownload}>
        {downloaded ? tc("downloaded") : tc("download")} &darr;
      </button>
      <button type="button" style={ghostButton} onClick={onReset}>
        {t("organizeAgain")}
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

"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { PageThumbnailGrid, type PageState } from "./page-thumbnail-grid";

type Tab = "range" | "pages" | "size" | "bookmarks" | "smart";
type RangeSubMode = "custom" | "fixed";
type PagesSubMode = "extractAll" | "select";
type SizeUnit = "KB" | "MB";
type Phase = "idle" | "uploading" | "processing" | "success";

interface RangeGroup {
  id: string;
  from: number;
  to: number;
}

interface Chunk {
  label: string;
  pages: number[];
  estBytes: number;
}

interface OutputFile {
  filename: string;
  r2Key: string;
  downloadUrl: string;
  size: number;
  pages: number;
}

interface SplitResult {
  files: OutputFile[];
  zip: { downloadUrl: string; r2Key: string; filename: string } | null;
  originalPages: number | null;
}

const RANGE_COLORS = ["#6C63FF", "#06B6D4", "#F59E0B", "#EC4899", "#22C55E", "#EF4444", "#8B5CF6", "#14B8A6"];

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

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r${Date.now()}-${Math.random()}`;
}

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

export function SplitTool() {
  const t = useTranslations("splitTool");
  const tc = useTranslations("common");
  const tp = useTranslations("toolPage");

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const [tab, setTab] = useState<Tab>("range");
  const [rangeSubMode, setRangeSubMode] = useState<RangeSubMode>("custom");
  const [ranges, setRanges] = useState<RangeGroup[]>([{ id: genId(), from: 1, to: 1 }]);
  const [fixedPagesPerFile, setFixedPagesPerFile] = useState(1);
  const [mergeRanges, setMergeRanges] = useState(false);

  const [pagesSubMode, setPagesSubMode] = useState<PagesSubMode>("extractAll");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [pagesInputText, setPagesInputText] = useState("");
  const [mergePages, setMergePages] = useState(false);
  const lastClickedRef = useRef<number | null>(null);

  const [maxSize, setMaxSize] = useState(500);
  const [maxSizeUnit, setMaxSizeUnit] = useState<SizeUnit>("KB");

  const [bookmarks, setBookmarks] = useState<{ title: string; pageNumber: number }[] | null>(null);
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<number>>(new Set());

  const [compress, setCompress] = useState(false);
  const [fileNameOverrides, setFileNameOverrides] = useState<Record<number, string>>({});

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SplitResult | null>(null);
  const [loggedIn, setLoggedIn] = useState(true);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = resultDeadline ? Math.max(0, Math.round((resultDeadline - now) / 1000)) : 3600;

  useEffect(() => {
    if (!resultDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resultDeadline]);

  // Read the outline once we have the file, so the Bookmarks tab can show
  // real data (or "no bookmarks found") without waiting for the user to
  // click into that tab first.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const outline = await pdf.getOutline();
        if (cancelled || !outline) {
          if (!cancelled) setBookmarks([]);
          return;
        }
        const entries: { title: string; pageNumber: number }[] = [];
        for (const item of outline) {
          try {
            const dest = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
            const ref = dest?.[0];
            if (ref == null) continue;
            const pageIndex = await pdf.getPageIndex(ref);
            entries.push({ title: item.title, pageNumber: pageIndex + 1 });
          } catch {
            // Skip entries whose destination can't be resolved.
          }
        }
        entries.sort((a, b) => a.pageNumber - b.pageNumber);
        if (!cancelled) setBookmarks(entries);
      } catch {
        if (!cancelled) setBookmarks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // ---- Keyboard shortcuts (Pages > Select mode) ----
  useEffect(() => {
    if (phase !== "idle" || tab !== "pages" || pagesSubMode !== "select" || !totalPages) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const all = new Set(Array.from({ length: totalPages! }, (_, i) => i + 1));
        setSelectedPages(all);
        setPagesInputText(pagesToRangeString([...all]));
      } else if (e.key === "Escape") {
        setSelectedPages(new Set());
        setPagesInputText("");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [phase, tab, pagesSubMode, totalPages]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setTotalPages(null);
    setRanges([{ id: genId(), from: 1, to: 1 }]);
    setSelectedPages(new Set());
    setPagesInputText("");
    setBookmarks(null);
    setSelectedBookmarks(new Set());
    setFileNameOverrides({});
    setResult(null);
    setError("");
    setPhase("idle");
  }

  function handleTotalPages(n: number) {
    setTotalPages(n);
    setRanges((prev) => [{ ...prev[0], to: Math.min(prev[0].to, n) || n }, ...prev.slice(1)]);
  }

  const avgPageBytes = file && totalPages ? file.size / totalPages : 0;

  const effectiveSelectedPages = useMemo(() => {
    if (tab !== "pages" || !totalPages) return new Set<number>();
    if (pagesSubMode === "extractAll") return new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    return selectedPages;
  }, [tab, totalPages, pagesSubMode, selectedPages]);

  const bookmarkRanges = useMemo(() => {
    if (!bookmarks || !totalPages) return [];
    const chosen = bookmarks.filter((b) => selectedBookmarks.has(b.pageNumber)).sort((a, b) => a.pageNumber - b.pageNumber);
    return chosen.map((b, i) => ({
      from: b.pageNumber,
      to: i + 1 < chosen.length ? chosen[i + 1].pageNumber - 1 : totalPages,
      name: b.title,
    }));
  }, [bookmarks, selectedBookmarks, totalPages]);

  // ---- Live preview: the single source of truth for both the preview panel
  // and the default output file names. ----
  const chunks: Chunk[] = useMemo(() => {
    if (!totalPages) return [];

    if (tab === "range") {
      let effectiveRanges: { from: number; to: number }[] = [];
      if (rangeSubMode === "custom") {
        effectiveRanges = ranges
          .map((r) => ({ from: Math.max(1, Math.min(r.from, totalPages)), to: Math.max(1, Math.min(r.to, totalPages)) }))
          .filter((r) => r.to >= r.from);
      } else {
        for (let start = 1; start <= totalPages; start += fixedPagesPerFile) {
          effectiveRanges.push({ from: start, to: Math.min(start + fixedPagesPerFile - 1, totalPages) });
        }
      }
      if (effectiveRanges.length === 0) return [];
      if (mergeRanges) {
        const pages = effectiveRanges.flatMap((r) => Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i));
        return [{ label: t("mergedFileLabel"), pages, estBytes: pages.length * avgPageBytes }];
      }
      return effectiveRanges.map((r, i) => ({
        label: t("rangeFileLabel", { n: i + 1 }),
        pages: Array.from({ length: r.to - r.from + 1 }, (_, j) => r.from + j),
        estBytes: (r.to - r.from + 1) * avgPageBytes,
      }));
    }

    if (tab === "pages") {
      const pages = [...effectiveSelectedPages].sort((a, b) => a - b);
      if (pages.length === 0) return [];
      if (mergePages) return [{ label: t("mergedFileLabel"), pages, estBytes: pages.length * avgPageBytes }];
      return pages.map((p) => ({ label: t("pageFileLabel", { n: p }), pages: [p], estBytes: avgPageBytes }));
    }

    if (tab === "size") {
      const maxBytes = Math.max(1, maxSize) * (maxSizeUnit === "MB" ? 1024 * 1024 : 1024);
      const result: Chunk[] = [];
      let current: number[] = [];
      let currentBytes = 0;
      for (let p = 1; p <= totalPages; p++) {
        if (current.length > 0 && currentBytes + avgPageBytes > maxBytes) {
          result.push({ label: t("rangeFileLabel", { n: result.length + 1 }), pages: current, estBytes: currentBytes });
          current = [];
          currentBytes = 0;
        }
        current.push(p);
        currentBytes += avgPageBytes;
      }
      if (current.length > 0) result.push({ label: t("rangeFileLabel", { n: result.length + 1 }), pages: current, estBytes: currentBytes });
      return result;
    }

    if (tab === "bookmarks") {
      return bookmarkRanges.map((r) => ({
        label: r.name,
        pages: Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i),
        estBytes: (r.to - r.from + 1) * avgPageBytes,
      }));
    }

    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, totalPages, rangeSubMode, ranges, fixedPagesPerFile, mergeRanges, effectiveSelectedPages, mergePages, maxSize, maxSizeUnit, bookmarkRanges, avgPageBytes]);

  const outputFileNames = chunks.map((c, i) => fileNameOverrides[i] ?? `${(file?.name ?? "document").replace(/\.pdf$/i, "")}-part-${i + 1}.pdf`);

  // ---- Page grid visuals ----
  function pageRangeIndex(pageNum: number): number {
    if (tab !== "range" || rangeSubMode !== "custom") return -1;
    return ranges.findIndex((r) => pageNum >= r.from && pageNum <= r.to);
  }

  function getPageState(pageNum: number): PageState {
    if (tab === "range") {
      if (rangeSubMode === "custom") {
        const idx = pageRangeIndex(pageNum);
        if (idx === -1) return { selected: false, dimmed: true };
        return { selected: true, borderColor: RANGE_COLORS[idx % RANGE_COLORS.length], checkColor: RANGE_COLORS[idx % RANGE_COLORS.length] };
      }
      const chunkIdx = chunks.findIndex((c) => c.pages.includes(pageNum));
      if (chunkIdx === -1) return { selected: false, dimmed: true };
      return { selected: true, borderColor: RANGE_COLORS[chunkIdx % RANGE_COLORS.length], checkColor: RANGE_COLORS[chunkIdx % RANGE_COLORS.length], label: `R${chunkIdx + 1}` };
    }
    if (tab === "pages") {
      const isSelected = effectiveSelectedPages.has(pageNum);
      return { selected: isSelected, borderColor: isSelected ? "var(--cs-ok)" : undefined, checkColor: "var(--cs-ok)", dimmed: !isSelected };
    }
    if (tab === "size") {
      const chunkIdx = chunks.findIndex((c) => c.pages.includes(pageNum));
      if (chunkIdx === -1) return { selected: false };
      return { selected: true, borderColor: RANGE_COLORS[chunkIdx % RANGE_COLORS.length], checkColor: RANGE_COLORS[chunkIdx % RANGE_COLORS.length], label: `${chunkIdx + 1}` };
    }
    if (tab === "bookmarks") {
      const chunkIdx = chunks.findIndex((c) => c.pages.includes(pageNum));
      if (chunkIdx === -1) return { selected: false, dimmed: true };
      return { selected: true, borderColor: RANGE_COLORS[chunkIdx % RANGE_COLORS.length], checkColor: RANGE_COLORS[chunkIdx % RANGE_COLORS.length] };
    }
    return { selected: false };
  }

  // Deliberately not using the setSelectedPages(prev => ...) updater form:
  // React 19 invokes updater functions twice in dev to check they're pure,
  // and this handler needs to both read and mutate lastClickedRef — an
  // impure updater sees its own ref mutation from the first "discarded"
  // invocation on the second, real one (e.g. shift-range collapses to a
  // single page because lastClickedRef already equals the new pageNum).
  // Reading `selectedPages` from the surrounding closure and calling
  // setSelectedPages with a plain value sidesteps that entirely.
  function handlePageClick(pageNum: number, modifiers: { ctrlKey: boolean; shiftKey: boolean }) {
    if (tab !== "pages" || pagesSubMode !== "select") return;
    const next = new Set(selectedPages);
    if (modifiers.shiftKey && lastClickedRef.current != null) {
      const [lo, hi] = [lastClickedRef.current, pageNum].sort((a, b) => a - b);
      for (let p = lo; p <= hi; p++) next.add(p);
    } else {
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
    }
    lastClickedRef.current = pageNum;
    setSelectedPages(next);
    setPagesInputText(pagesToRangeString([...next]));
  }

  function handleDropPageOnPage(draggedPage: number, targetPage: number) {
    if (tab !== "range" || rangeSubMode !== "custom") return;
    const sourceIdx = pageRangeIndex(draggedPage);
    const targetIdx = pageRangeIndex(targetPage);
    if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return;
    setRanges((prev) => {
      const next = prev.map((r) => ({ ...r }));
      const source = next[sourceIdx];
      const target = next[targetIdx];
      // Only handle the common case: dragging a page off one end of its
      // range into an adjacent range extends the target and trims the source.
      if (draggedPage === source.to && draggedPage === target.from - 1) {
        source.to -= 1;
        target.from -= 1;
      } else if (draggedPage === source.from && draggedPage === target.to + 1) {
        source.from += 1;
        target.to += 1;
      }
      return next;
    });
  }

  // ---- Submission ----
  async function handleSplit() {
    if (!file || chunks.length === 0) {
      setError(t("noChunksError"));
      return;
    }
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    setEtaSeconds(Math.max(1, Math.round((totalPages ?? 1) * 0.08)));

    const config: Record<string, unknown> = { compress };
    if (tab === "range" || tab === "bookmarks") {
      const effectiveRanges =
        tab === "bookmarks"
          ? bookmarkRanges
          : rangeSubMode === "custom"
            ? ranges
                .map((r) => ({ from: Math.max(1, Math.min(r.from, totalPages ?? r.from)), to: Math.max(1, Math.min(r.to, totalPages ?? r.to)) }))
                .filter((r) => r.to >= r.from)
            : chunks.map((c) => ({ from: c.pages[0], to: c.pages[c.pages.length - 1] }));
      config.mode = "range";
      config.ranges = effectiveRanges;
      config.mergeRanges = tab === "range" ? mergeRanges : false;
    } else if (tab === "pages") {
      config.mode = "pages";
      config.selectedPages = [...effectiveSelectedPages];
      config.mergePages = mergePages;
    } else if (tab === "size") {
      config.mode = "size";
      config.maxSizeKB = maxSizeUnit === "MB" ? maxSize * 1024 : maxSize;
    } else if (tab === "smart") {
      config.mode = "smart";
    }
    config.fileNames = outputFileNames;

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("config", JSON.stringify(config));

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/split");
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
        abortController.signal.addEventListener("abort", () => xhr.abort());
        xhr.send(formData);
      });

      if (status === 429) {
        setError((json.error as string) || tc("error"));
        setPhase("idle");
        return;
      }
      if (status < 200 || status >= 300) {
        setError((json.error as string) || tc("error"));
        setPhase("idle");
        return;
      }
      if (json.comingSoon) {
        setError(json.message as string);
        setPhase("idle");
        return;
      }

      setResult({ files: json.files as OutputFile[], zip: json.zip as SplitResult["zip"], originalPages: json.originalPages as number | null });
      setLoggedIn(!!json.loggedIn);
      setResultDeadline(Date.now() + 3600_000);
      setNow(Date.now());
      setPhase("success");
    } catch {
      if (abortController.signal.aborted) {
        setPhase("idle");
      } else {
        setError(tc("couldntReachServer"));
        setPhase("idle");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setResultDeadline(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDownloadZip() {
    if (!result?.zip) return;
    window.location.href = result.zip.downloadUrl;
  }

  // ------------------------------------------------------------------------
  // Empty state
  // ------------------------------------------------------------------------
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
            <button type="button" style={{ ...ghostButton, padding: "6px 12px", fontSize: 12.5 }} onClick={reset} disabled={phase !== "idle" && phase !== "success"}>
              {tc("chooseAnotherFile")}
            </button>
          </div>

          <PageThumbnailGrid
            key={`${file.name}-${file.size}-${file.lastModified}`}
            file={file}
            getPageState={getPageState}
            onPageClick={handlePageClick}
            onTotalPages={handleTotalPages}
            draggable={tab === "range" && rangeSubMode === "custom"}
            onDropPageOnPage={handleDropPageOnPage}
          />

          {tab === "pages" && pagesSubMode === "select" && (
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--cs-text-2)", textAlign: "center" }}>{t("shortcutsHint")}</div>
          )}
        </div>

        {/* RIGHT: config panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {phase === "success" && result ? (
            <ResultPanel result={result} loggedIn={loggedIn} secondsLeft={secondsLeft} onDownloadZip={handleDownloadZip} onReset={reset} compress={compress} />
          ) : (
            <>
              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {(["range", "pages", "size", "bookmarks", "smart"] as Tab[]).map((tb) => (
                    <button
                      key={tb}
                      type="button"
                      onClick={() => setTab(tb)}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 8,
                        border: "1px solid " + (tab === tb ? "var(--cs-accent)" : "var(--cs-line)"),
                        background: tab === tb ? "var(--cs-accent)" : "transparent",
                        color: tab === tb ? "#fff" : "var(--cs-text)",
                        fontSize: 12.5,
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {t(`tab.${tb}`)}
                      {tb === "smart" && <span style={{ marginLeft: 5, fontSize: 9.5, fontWeight: 700, opacity: 0.85 }}>PRO</span>}
                    </button>
                  ))}
                </div>

                {tab === "range" && (
                  <RangeModePanel
                    subMode={rangeSubMode}
                    setSubMode={setRangeSubMode}
                    ranges={ranges}
                    setRanges={setRanges}
                    totalPages={totalPages ?? 1}
                    fixedPagesPerFile={fixedPagesPerFile}
                    setFixedPagesPerFile={setFixedPagesPerFile}
                    mergeRanges={mergeRanges}
                    setMergeRanges={setMergeRanges}
                    chunkCount={chunks.length}
                    t={t}
                  />
                )}
                {tab === "pages" && (
                  <PagesModePanel
                    subMode={pagesSubMode}
                    setSubMode={setPagesSubMode}
                    totalPages={totalPages ?? 0}
                    selectedPages={selectedPages}
                    pagesInputText={pagesInputText}
                    onPagesInputChange={(text) => {
                      setPagesInputText(text);
                      setSelectedPages(new Set(parsePagesInput(text, totalPages ?? 0)));
                    }}
                    mergePages={mergePages}
                    setMergePages={setMergePages}
                    t={t}
                  />
                )}
                {tab === "size" && (
                  <SizeModePanel
                    maxSize={maxSize}
                    setMaxSize={setMaxSize}
                    maxSizeUnit={maxSizeUnit}
                    setMaxSizeUnit={setMaxSizeUnit}
                    fileSize={file.size}
                    totalPages={totalPages ?? 0}
                    resultCount={chunks.length}
                    t={t}
                  />
                )}
                {tab === "bookmarks" && (
                  <BookmarksModePanel bookmarks={bookmarks} selectedBookmarks={selectedBookmarks} setSelectedBookmarks={setSelectedBookmarks} t={t} />
                )}
                {tab === "smart" && <SmartModePanel t={t} />}
              </div>

              {tab !== "smart" && chunks.length > 0 && (
                <PreviewPanel chunks={chunks} totalPages={totalPages ?? 0} fileNames={outputFileNames} onRename={(i, name) => setFileNameOverrides((prev) => ({ ...prev, [i]: name }))} t={t} />
              )}

              {tab !== "smart" && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cs-text-2)", cursor: "pointer" }}>
                  <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                  {t("compressOutputLabel")}
                </label>
              )}

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
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("processingPages", { total: totalPages ?? 0 })}</div>
                  <ProcessingCountdown seconds={etaSeconds} t={t} />
                  <button type="button" style={{ ...ghostButton, borderColor: "var(--cs-line)", color: "var(--cs-text-2)" }} onClick={handleCancel}>
                    {tc("cancel")}
                  </button>
                </div>
              )}

              {phase === "idle" && (
                <button type="button" style={bigActionButton} onClick={handleSplit} disabled={chunks.length === 0 && tab !== "smart"}>
                  {t("splitButton")} &rarr;
                </button>
              )}

              {error && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-card)", padding: 14 }}>
                  <span style={{ fontSize: 17 }}>⚠️</span>
                  <div style={{ fontSize: 13, color: "var(--cs-text)" }}>{error}</div>
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

function ProcessingCountdown({ seconds, t }: { seconds: number; t: ReturnType<typeof useTranslations> }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t("estimatedTime", { time: `${left}s` })}</div>;
}

// ---------------------------------------------------------------------------
// Range mode panel
// ---------------------------------------------------------------------------
function RangeModePanel({
  subMode,
  setSubMode,
  ranges,
  setRanges,
  totalPages,
  fixedPagesPerFile,
  setFixedPagesPerFile,
  mergeRanges,
  setMergeRanges,
  chunkCount,
  t,
}: {
  subMode: RangeSubMode;
  setSubMode: (m: RangeSubMode) => void;
  ranges: RangeGroup[];
  setRanges: React.Dispatch<React.SetStateAction<RangeGroup[]>>;
  totalPages: number;
  fixedPagesPerFile: number;
  setFixedPagesPerFile: (n: number) => void;
  mergeRanges: boolean;
  setMergeRanges: (b: boolean) => void;
  chunkCount: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(["custom", "fixed"] as RangeSubMode[]).map((sm) => (
          <button
            key={sm}
            type="button"
            onClick={() => setSubMode(sm)}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "1px solid " + (subMode === sm ? "var(--cs-accent)" : "var(--cs-line)"),
              background: subMode === sm ? "var(--cs-accent-soft)" : "transparent",
              color: subMode === sm ? "var(--cs-accent)" : "var(--cs-text-2)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t(`rangeSubMode.${sm}`)}
          </button>
        ))}
      </div>

      {subMode === "custom" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ranges.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, border: `1.5px solid ${RANGE_COLORS[i % RANGE_COLORS.length]}33`, background: "var(--cs-bg-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: RANGE_COLORS[i % RANGE_COLORS.length], flex: "none" }} />
              <span style={{ fontSize: 12, color: "var(--cs-text-2)", flex: "none" }}>{t("rangeLabel", { n: i + 1 })}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={r.from}
                onChange={(e) => {
                  const clamped = Math.min(Math.max(1, Number(e.target.value) || 1), totalPages);
                  setRanges((prev) => prev.map((x) => (x.id === r.id ? { ...x, from: clamped } : x)));
                }}
                style={{ ...inputStyle, width: 60 }}
              />
              <span style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t("toLabel")}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={r.to}
                onChange={(e) => {
                  const clamped = Math.min(Math.max(1, Number(e.target.value) || 1), totalPages);
                  setRanges((prev) => prev.map((x) => (x.id === r.id ? { ...x, to: clamped } : x)));
                }}
                style={{ ...inputStyle, width: 60 }}
              />
              {ranges.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRanges((prev) => prev.filter((x) => x.id !== r.id))}
                  aria-label={t("removeRange")}
                  style={{ marginLeft: "auto", border: "none", background: "none", color: "var(--cs-text-2)", cursor: "pointer", fontSize: 15, flex: "none" }}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            style={ghostButton}
            onClick={() => setRanges((prev) => [...prev, { id: genId(), from: Math.min(totalPages, (prev[prev.length - 1]?.to ?? 0) + 1), to: totalPages }])}
          >
            + {t("addRange")}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cs-text-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={mergeRanges} onChange={(e) => setMergeRanges(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
            {t("mergeRangesLabel")}
          </label>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--cs-text-2)" }}>
            {t("splitIntoRangesOf")}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" style={{ ...ghostButton, padding: "6px 11px" }} onClick={() => setFixedPagesPerFile(Math.max(1, fixedPagesPerFile - 1))}>
                &minus;
              </button>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={fixedPagesPerFile}
                onChange={(e) => setFixedPagesPerFile(Math.max(1, Number(e.target.value)))}
                style={{ ...inputStyle, width: 70, textAlign: "center" }}
              />
              <button type="button" style={{ ...ghostButton, padding: "6px 11px" }} onClick={() => setFixedPagesPerFile(fixedPagesPerFile + 1)}>
                +
              </button>
              <span>{t("pagesUnit")}</span>
            </div>
          </label>
          <div style={{ fontSize: 12.5, color: "var(--cs-text-2)", lineHeight: 1.5 }}>{t("fixedSplitInfo", { count: chunkCount, n: fixedPagesPerFile })}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pages mode panel
// ---------------------------------------------------------------------------
function PagesModePanel({
  subMode,
  setSubMode,
  totalPages,
  selectedPages,
  pagesInputText,
  onPagesInputChange,
  mergePages,
  setMergePages,
  t,
}: {
  subMode: PagesSubMode;
  setSubMode: (m: PagesSubMode) => void;
  totalPages: number;
  selectedPages: Set<number>;
  pagesInputText: string;
  onPagesInputChange: (text: string) => void;
  mergePages: boolean;
  setMergePages: (b: boolean) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(["extractAll", "select"] as PagesSubMode[]).map((sm) => (
          <button
            key={sm}
            type="button"
            onClick={() => setSubMode(sm)}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "1px solid " + (subMode === sm ? "var(--cs-accent)" : "var(--cs-line)"),
              background: subMode === sm ? "var(--cs-accent-soft)" : "transparent",
              color: subMode === sm ? "var(--cs-accent)" : "var(--cs-text-2)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t(`pagesSubMode.${sm}`)}
          </button>
        ))}
      </div>

      {subMode === "extractAll" ? (
        <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("extractAllInfo", { count: totalPages })}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("pagesSelectedCount", { count: selectedPages.size })}</div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)" }}>
            {t("pagesToExtractLabel")}
            <input type="text" placeholder={t("pagesToExtractPlaceholder")} value={pagesInputText} onChange={(e) => onPagesInputChange(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cs-text-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={mergePages} onChange={(e) => setMergePages(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
            {t("mergePagesLabel")}
          </label>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Size mode panel
// ---------------------------------------------------------------------------
function SizeModePanel({
  maxSize,
  setMaxSize,
  maxSizeUnit,
  setMaxSizeUnit,
  fileSize,
  totalPages,
  resultCount,
  t,
}: {
  maxSize: number;
  setMaxSize: (n: number) => void;
  maxSizeUnit: SizeUnit;
  setMaxSizeUnit: (u: SizeUnit) => void;
  fileSize: number;
  totalPages: number;
  resultCount: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("originalInfo", { size: formatBytes(fileSize), pages: totalPages })}</div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)" }}>
        {t("maxSizePerFileLabel")}
        <div style={{ display: "flex", gap: 6 }}>
          <input type="number" min={1} value={maxSize} onChange={(e) => setMaxSize(Math.max(1, Number(e.target.value)))} style={inputStyle} />
          <div style={{ display: "flex", border: "1px solid var(--cs-line)", borderRadius: 8, overflow: "hidden", flex: "none" }}>
            {(["KB", "MB"] as SizeUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setMaxSizeUnit(u)}
                style={{
                  padding: "9px 12px",
                  border: "none",
                  background: maxSizeUnit === u ? "var(--cs-accent)" : "transparent",
                  color: maxSizeUnit === u ? "#fff" : "var(--cs-text)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </label>
      <div style={{ fontSize: 12.5, color: "var(--cs-text-2)", lineHeight: 1.5 }}>
        {t("sizeSplitInfo", { size: `${maxSize}${maxSizeUnit}`, count: resultCount })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookmarks mode panel
// ---------------------------------------------------------------------------
function BookmarksModePanel({
  bookmarks,
  selectedBookmarks,
  setSelectedBookmarks,
  t,
}: {
  bookmarks: { title: string; pageNumber: number }[] | null;
  selectedBookmarks: Set<number>;
  setSelectedBookmarks: React.Dispatch<React.SetStateAction<Set<number>>>;
  t: ReturnType<typeof useTranslations>;
}) {
  if (bookmarks === null) {
    return <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("checkingBookmarks")}</div>;
  }
  if (bookmarks.length === 0) {
    return <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("noBookmarksFound")}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("bookmarksFoundInfo", { count: bookmarks.length })}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
        {bookmarks.map((b) => (
          <label key={`${b.title}-${b.pageNumber}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selectedBookmarks.has(b.pageNumber)}
              onChange={(e) =>
                setSelectedBookmarks((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(b.pageNumber);
                  else next.delete(b.pageNumber);
                  return next;
                })
              }
              style={{ width: 14, height: 14, accentColor: "var(--cs-accent)", flex: "none" }}
            />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</span>
            <span style={{ marginLeft: "auto", color: "var(--cs-text-2)", flex: "none" }}>p.{b.pageNumber}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart mode panel (Pro stub)
// ---------------------------------------------------------------------------
const CATEGORY_KEYS = [
  "invoices",
  "contracts",
  "bankStatements",
  "academic",
  "medical",
  "hr",
  "insurance",
  "shipping",
  "government",
  "scanned",
  "marketing",
  "books",
  "custom",
];

function SmartModePanel({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [showNudge, setShowNudge] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)" }}>
        {t("documentCategoryLabel")}
        <select style={inputStyle} onChange={() => setShowNudge(true)} defaultValue="">
          <option value="" disabled>
            {t("chooseOption")}
          </option>
          {CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`category.${k}`)}
            </option>
          ))}
        </select>
      </label>
      {showNudge && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 12, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)" }}>
          <div style={{ fontSize: 13, color: "var(--cs-text)" }}>{t("proFeatureNudge")}</div>
          <Link href="/pricing" style={{ display: "inline-block", padding: "9px 16px", borderRadius: 9, background: "var(--cs-accent)", color: "#fff", fontSize: 13, fontWeight: 500, textDecoration: "none", width: "fit-content" }}>
            {t("upgradeToPro")}
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview panel
// ---------------------------------------------------------------------------
function PreviewPanel({
  chunks,
  totalPages,
  fileNames,
  onRename,
  t,
}: {
  chunks: Chunk[];
  totalPages: number;
  fileNames: string[];
  onRename: (i: number, name: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cs-text-2)" }}>{t("previewTitle")}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{t("previewSummary", { pages: totalPages, files: chunks.length })}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
        {chunks.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--cs-text-2)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: RANGE_COLORS[i % RANGE_COLORS.length], flex: "none" }} />
            <input
              type="text"
              value={fileNames[i]}
              onChange={(e) => onRename(i, e.target.value)}
              style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, flex: "1 1 auto", minWidth: 0 }}
            />
            <span style={{ flex: "none", whiteSpace: "nowrap" }}>
              {c.pages.length} p. &middot; ~{formatBytes(c.estBytes)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result panel
// ---------------------------------------------------------------------------
function ResultPanel({
  result,
  loggedIn,
  secondsLeft,
  onDownloadZip,
  onReset,
  compress,
}: {
  result: SplitResult;
  loggedIn: boolean;
  secondsLeft: number;
  onDownloadZip: () => void;
  onReset: () => void;
  compress: boolean;
}) {
  const t = useTranslations("splitTool");
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
        <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 17, fontWeight: 600 }}>{t("resultsTitle", { count: result.files.length })}</div>
      </div>

      {result.zip && (
        <button type="button" className="hover-text" style={bigActionButton} onClick={onDownloadZip}>
          {t("downloadAllZip")} &darr;
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
        {result.files.map((f) => (
          <div key={f.r2Key} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, border: "1px solid var(--cs-line)" }}>
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</div>
              <div style={{ fontSize: 11, color: "var(--cs-text-2)", display: "flex", gap: 6, alignItems: "center" }}>
                <span>
                  {f.pages} p. &middot; {formatBytes(f.size)}
                </span>
                {compress && (
                  <span style={{ padding: "1px 6px", borderRadius: 6, background: "var(--cs-accent-soft)", color: "var(--cs-accent)", fontSize: 10, fontWeight: 600 }}>
                    {t("compressedBadge")}
                  </span>
                )}
              </div>
            </div>
            <a href={f.downloadUrl} style={{ flex: "none", padding: "7px 12px", borderRadius: 8, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 12, fontWeight: 500, textDecoration: "none", cursor: "pointer" }}>
              {tc("download")}
            </a>
          </div>
        ))}
      </div>

      <button type="button" style={ghostButton} onClick={onReset}>
        {t("splitAgain")}
      </button>

      <div style={{ fontSize: 12, color: "var(--cs-text-2)", textAlign: "center" }}>🕐 {tp("fileDeletedIn", { time: formatCountdown(secondsLeft) })}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", fontSize: 11.5, color: "var(--cs-text-2)", paddingTop: 8, borderTop: "1px solid var(--cs-line)" }}>
        <span>🔒 {tp("trustEncrypted")}</span>
        <span>✓ {tai("trustNeverTraining")}</span>
      </div>

      {!loggedIn && (
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

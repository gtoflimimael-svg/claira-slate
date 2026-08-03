"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";

type Tool = "select" | "add-text";
type Alignment = "left" | "center" | "right";
type Phase = "idle" | "uploading" | "processing" | "success";

interface LineBox {
  x0: number;
  y0: number; // bottom
  y1: number; // top
  x1: number;
  baseline: number;
  text: string;
}

interface ClientEdit {
  id: string;
  page: number;
  x: number;
  y: number; // baseline
  width?: number;
  height?: number;
  originalText?: string;
  newText: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  alignment: Alignment;
  isNew: boolean;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

const smallButton: CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const toolbarBtn = (active: boolean): CSSProperties => ({
  padding: "7px 14px",
  borderRadius: 8,
  border: active ? "1.5px solid var(--cs-accent)" : "1px solid var(--cs-line)",
  background: active ? "var(--cs-accent-soft)" : "transparent",
  color: active ? "var(--cs-accent)" : "var(--cs-text)",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
});
const bigActionButton: CSSProperties = { width: "100%", height: 52, border: "none", borderRadius: 12, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButton: CSSProperties = { padding: "9px 14px", borderRadius: 9, border: "1.5px solid var(--cs-accent-line)", background: "transparent", color: "var(--cs-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const inputStyle: CSSProperties = { padding: "8px 9px", border: "1px solid var(--cs-line)", borderRadius: 8, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13, outline: "none", width: "100%" };
const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function EditTextTool() {
  const t = useTranslations("editTextTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const linesCacheRef = useRef<Map<number, LineBox[]>>(new Map());

  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizePt, setPageSizePt] = useState({ w: 612, h: 792 });
  const [zoom, setZoom] = useState(1);
  const [renderTick, setRenderTick] = useState(0);

  const [tool, setTool] = useState<Tool>("select");
  const [edits, setEdits] = useState<ClientEdit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const historyRef = useRef<ClientEdit[][]>([[]]);
  const historyIndexRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; r2Key: string; size: number; blocksEdited: number; loggedIn: boolean } | null>(null);
  const [processingSeconds, setProcessingSeconds] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = resultDeadline ? Math.max(0, Math.round((resultDeadline - now) / 1000)) : 3600;

  const disabled = phase !== "idle";

  useEffect(() => {
    if (!resultDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resultDeadline]);

  const commit = useCallback((next: ClientEdit[]) => {
    setEdits(next);
    const hist = historyRef.current.slice(0, historyIndexRef.current + 1);
    hist.push(next);
    historyRef.current = hist;
    historyIndexRef.current = hist.length - 1;
  }, []);
  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setEdits(historyRef.current[historyIndexRef.current]);
  }, []);
  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setEdits(historyRef.current[historyIndexRef.current]);
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      const buffer = await file.arrayBuffer();
      if (cancelled) return;
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      if (cancelled) return;
      pdfDocRef.current = pdf;
      linesCacheRef.current = new Map();
      setPageCount(pdf.numPages);
      setCurrentPage(1);
      setRenderTick((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(currentPage);
      if (cancelled) return;
      const unscaled = page.getViewport({ scale: 1 });
      setPageSizePt({ w: unscaled.width, h: unscaled.height });

      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;

      if (!linesCacheRef.current.has(currentPage)) {
        const content = await page.getTextContent();
        const buckets = new Map<number, LineBox & { parts: { x: number; s: string }[] }>();
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const tx = item.transform;
          const x0 = tx[4];
          const y0 = tx[5];
          const height = item.height || 10;
          const width = item.width || 0;
          const bottom = y0 - height * 0.2;
          const top = y0 + height * 0.8;
          const key = Math.round(y0 / 2) * 2;
          const existing = buckets.get(key);
          if (!existing) buckets.set(key, { x0, x1: x0 + width, y0: bottom, y1: top, baseline: y0, text: "", parts: [{ x: x0, s: item.str }] });
          else {
            existing.x0 = Math.min(existing.x0, x0);
            existing.x1 = Math.max(existing.x1, x0 + width);
            existing.y0 = Math.min(existing.y0, bottom);
            existing.y1 = Math.max(existing.y1, top);
            existing.baseline = Math.min(existing.baseline, y0);
            existing.parts.push({ x: x0, s: item.str });
          }
        }
        const lines: LineBox[] = [];
        for (const b of buckets.values()) {
          const text = b.parts
            .sort((a, c) => a.x - c.x)
            .map((p) => p.s)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          lines.push({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, baseline: b.baseline, text });
        }
        linesCacheRef.current.set(currentPage, lines);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, zoom, renderTick]);

  const canvasW = pageSizePt.w * zoom;
  const canvasH = pageSizePt.h * zoom;
  const toPdf = useCallback((screenX: number, screenY: number): [number, number] => [screenX / zoom, pageSizePt.h - screenY / zoom], [zoom, pageSizePt.h]);
  const toScreenX = useCallback((x: number) => x * zoom, [zoom]);
  const toScreenY = useCallback((y: number) => (pageSizePt.h - y) * zoom, [zoom, pageSizePt.h]);

  function fitWidth() {
    if (!containerRef.current) return;
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (containerRef.current.clientWidth - 4) / pageSizePt.w)));
  }
  function fitPage() {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth - 4;
    const ch = containerRef.current.clientHeight - 4;
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(cw / pageSizePt.w, ch / pageSizePt.h))));
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [px, py] = toPdf(sx, sy);

    if (tool === "add-text") {
      const id = uid();
      const next: ClientEdit = { id, page: currentPage, x: px, y: py, newText: "", fontSize: 14, color: "#000000", bold: false, italic: false, alignment: "left", isNew: true };
      commit([...edits, next]);
      setSelectedId(id);
      return;
    }

    const existingEdit = edits.find((ed) => ed.page === currentPage && px >= ed.x - 2 && px <= (ed.x + (ed.width ?? 200)) + 2 && py >= ed.y - 4 && py <= ed.y + (ed.height ?? 14) + 4);
    if (existingEdit) {
      setSelectedId(existingEdit.id);
      return;
    }

    const lines = linesCacheRef.current.get(currentPage) ?? [];
    const hit = lines.find((l) => px >= l.x0 - 2 && px <= l.x1 + 2 && py >= l.y0 - 2 && py <= l.y1 + 2);
    if (!hit) {
      setSelectedId(null);
      return;
    }
    const id = uid();
    const next: ClientEdit = {
      id,
      page: currentPage,
      x: hit.x0,
      y: hit.baseline,
      width: hit.x1 - hit.x0,
      height: hit.y1 - hit.y0,
      originalText: hit.text,
      newText: hit.text,
      fontSize: Math.max(6, hit.y1 - hit.y0),
      color: "#000000",
      bold: false,
      italic: false,
      alignment: "left",
      isNew: false,
    };
    commit([...edits, next]);
    setSelectedId(id);
  }

  function updateSelected(patch: Partial<ClientEdit>) {
    if (!selectedId) return;
    commit(edits.map((ed) => (ed.id === selectedId ? { ...ed, ...patch } : ed)));
  }

  function deleteSelected() {
    if (!selectedId) return;
    commit(edits.filter((ed) => ed.id !== selectedId));
    setSelectedId(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const activeTag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "Escape") setTool("select");
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, edits, undo, redo]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setResult(null);
    setError("");
    setEdits([]);
    historyRef.current = [[]];
    historyIndexRef.current = 0;
    setSelectedId(null);
  }

  async function handleSubmit() {
    if (!file) return;
    if (edits.length === 0) {
      setError(t("emptyError"));
      return;
    }
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("config", JSON.stringify({ edits: edits.filter((e) => e.newText.trim()).map((e) => ({ ...e, id: undefined })) }));

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/edit-text");
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
        router.push("/login?redirect=/tools/edit-text");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "edit-text", plan: (json.plan as Plan) ?? "free" });
        return;
      }
      if (status < 200 || status >= 300) {
        setError((json.error as string) || tc("error"));
        setPhase("idle");
        return;
      }

      setProcessingSeconds((Date.now() - startTimeRef.current) / 1000);
      setNow(Date.now());
      setResultDeadline(Date.now() + 3600_000);
      setResult({
        downloadUrl: json.downloadUrl as string,
        filename: json.filename as string,
        r2Key: json.r2Key as string,
        size: (json.size as number) ?? 0,
        blocksEdited: (json.blocksEdited as number) ?? 0,
        loggedIn: !!json.loggedIn,
      });
      setPhase("success");
      track("tool_used", { tool_name: "edit-text", user_plan: (json.plan as Plan) ?? "free", file_size: file.size, success: true });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: "edit-text" });
  }

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setError("");
    setDownloaded(false);
    setEdits([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  const pageEdits = useMemo(() => edits.filter((e) => e.page === currentPage), [edits, currentPage]);
  const selected = edits.find((e) => e.id === selectedId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

      {!file ? (
        <div
          style={{ border: "1.5px dashed var(--cs-accent-line)", borderRadius: 16, background: "var(--cs-accent-soft)", padding: "56px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600 }}>{tp("dropFileHere")}</div>
          <button type="button" className="hover-text" style={bigActionButton} onClick={() => inputRef.current?.click()}>
            {tc("selectFile")}
          </button>
        </div>
      ) : phase === "success" && result ? (
        <div style={{ maxWidth: 480, margin: "0 auto", width: "100%", border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center", flex: "none" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          </motion.div>
          <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600 }}>{t("resultHeadline")}</div>
          <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>
            <div style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{result.filename}</div>
            <div style={{ marginTop: 3 }}>
              {formatBytes(result.size)} · {t("blocksEdited", { count: result.blocksEdited })}
              {processingSeconds !== null && ` · ${tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}`}
            </div>
          </div>
          <button type="button" className="hover-text" style={bigActionButton} onClick={handleDownload}>
            {downloaded ? tc("downloaded") : tc("download")} &darr;
          </button>
          <button type="button" style={ghostButton} onClick={reset}>
            {t("processAnother")}
          </button>
          <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>🕐 {tp("fileDeletedIn", { time: `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}` })}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", fontSize: 11.5, color: "var(--cs-text-2)", paddingTop: 8, borderTop: "1px solid var(--cs-line)", width: "100%" }}>
            <span>🔒 {tp("trustEncrypted")}</span>
            <span>✓ {tai("trustNeverTraining")}</span>
          </div>
          {!result.loggedIn && (
            <Link href="/signup" style={{ display: "block", width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", color: "var(--cs-text)", fontSize: 12.5, lineHeight: 1.5, textDecoration: "none" }}>
              {tp("loginNudge")} &rarr;
            </Link>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid var(--cs-accent-line)", borderRadius: 12, background: "var(--cs-accent-soft)", padding: 12 }}>
            <span style={{ fontSize: 15 }}>ℹ️</span>
            <div style={{ fontSize: 12.5, color: "var(--cs-text)", lineHeight: 1.5 }}>{t("disclaimer")}</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-card)", padding: 10 }}>
            <button type="button" style={toolbarBtn(tool === "select")} onClick={() => setTool("select")}>
              {t("selectTool")}
            </button>
            <button type="button" style={toolbarBtn(tool === "add-text")} onClick={() => setTool("add-text")}>
              {t("addTextTool")}
            </button>
            <div style={{ width: 1, alignSelf: "stretch", background: "var(--cs-line)" }} />
            <button type="button" style={smallButton} onClick={undo} title="Ctrl+Z">
              ↺
            </button>
            <button type="button" style={smallButton} onClick={redo} title="Ctrl+Shift+Z">
              ↻
            </button>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" style={smallButton} disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                &larr;
              </button>
              <span style={{ fontSize: 12.5 }}>{t("pageOf", { current: currentPage, total: pageCount })}</span>
              <button type="button" style={smallButton} disabled={currentPage === pageCount} onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}>
                &rarr;
              </button>
              <button type="button" style={smallButton} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))}>
                −
              </button>
              <span style={{ fontSize: 12.5 }}>{Math.round(zoom * 100)}%</span>
              <button type="button" style={smallButton} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}>
                +
              </button>
              <button type="button" style={smallButton} onClick={fitWidth}>
                {t("fitWidth")}
              </button>
              <button type="button" style={smallButton} onClick={fitPage}>
                {t("fitPage")}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div ref={containerRef} style={{ flex: 1, minWidth: 0, border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-bg)", padding: 16, overflow: "auto", maxHeight: "70vh", display: "flex", justifyContent: "center" }}>
              <div style={{ position: "relative", width: canvasW, height: canvasH, flex: "none" }}>
                <canvas ref={canvasRef} style={{ display: "block", width: canvasW, height: canvasH }} />
                <svg width={canvasW} height={canvasH} style={{ position: "absolute", inset: 0, cursor: tool === "add-text" ? "text" : "pointer" }} onClick={handleCanvasClick}>
                  {pageEdits.map((ed) => {
                    const x = toScreenX(ed.x);
                    const w = (ed.width ?? 160) * zoom;
                    const yTop = toScreenY(ed.y) - (ed.height ?? ed.fontSize) * zoom;
                    const h = (ed.height ?? ed.fontSize * 1.3) * zoom;
                    return (
                      <rect
                        key={ed.id}
                        x={x - 2}
                        y={yTop - 2}
                        width={w + 4}
                        height={h + 4}
                        fill={selectedId === ed.id ? "var(--cs-accent-soft)" : "rgba(124,58,237,0.06)"}
                        stroke={selectedId === ed.id ? "var(--cs-accent)" : "transparent"}
                        strokeDasharray="4 3"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            <div style={{ width: 280, flex: "none", border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={sectionTitle}>{t("propertiesHeading")}</div>
              {!selected ? (
                <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("noSelection")}</div>
              ) : (
                <>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                    {t("contentLabel")}
                    <textarea value={selected.newText} onChange={(e) => updateSelected({ newText: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                    {t("fontSizeLabel", { size: Math.round(selected.fontSize) })}
                    <input type="range" min={6} max={72} value={selected.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                    {t("colorLabel")}
                    <input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} style={{ width: 44, height: 30, border: "1px solid var(--cs-line)", borderRadius: 6, padding: 0, background: "none" }} />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => updateSelected({ bold: !selected.bold })} style={{ ...smallButton, fontWeight: 700, background: selected.bold ? "var(--cs-accent-soft)" : "transparent", borderColor: selected.bold ? "var(--cs-accent)" : "var(--cs-line)" }}>
                      B
                    </button>
                    <button type="button" onClick={() => updateSelected({ italic: !selected.italic })} style={{ ...smallButton, fontStyle: "italic", background: selected.italic ? "var(--cs-accent-soft)" : "transparent", borderColor: selected.italic ? "var(--cs-accent)" : "var(--cs-line)" }}>
                      I
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t("alignmentLabel")}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["left", "center", "right"] as Alignment[]).map((al) => (
                        <button key={al} type="button" onClick={() => updateSelected({ alignment: al })} style={{ ...smallButton, flex: 1, background: selected.alignment === al ? "var(--cs-accent-soft)" : "transparent", borderColor: selected.alignment === al ? "var(--cs-accent)" : "var(--cs-line)" }}>
                          {t(`align.${al}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" style={{ ...smallButton, marginTop: 4 }} onClick={() => setSelectedId(null)}>
                    {t("applyChanges")}
                  </button>
                  <button type="button" style={{ ...smallButton, color: "#c0392b", borderColor: "#c0392b" }} onClick={deleteSelected}>
                    {t("deleteBlock")}
                  </button>
                </>
              )}
            </div>
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
            <button type="button" style={bigActionButton} onClick={handleSubmit} disabled={!file}>
              {t("saveButton")} &rarr;
            </button>
          )}
          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid var(--cs-accent-line)", borderRadius: 14, background: "var(--cs-card)", padding: 14 }}>
              <span style={{ fontSize: 17 }}>⚠️</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto" }}>
                <div style={{ fontSize: 13, color: "var(--cs-text)" }}>{error}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="hover-text" style={smallButton} onClick={handleSubmit}>
                    {tc("tryAgain")}
                  </button>
                  <Link href="/contact" style={{ display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: "var(--cs-accent)" }}>
                    {tp("contactSupport")}
                  </Link>
                </div>
              </div>
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

      <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: "10px 22px", justifyContent: "center", fontSize: 12.5, color: "var(--cs-text-2)" }}>
        <span>🔒 {tp("trustDeleted")}</span>
        <span>✓ {tp("trustNoAccount")}</span>
        <span>⚡ {tp("trustFast")}</span>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";

type AnnotationType = "highlight" | "underline" | "strikethrough" | "comment" | "textbox" | "draw" | "arrow" | "rectangle" | "ellipse";
type Tool = "select" | "erase" | AnnotationType;
type Phase = "idle" | "uploading" | "processing" | "success";

interface ClientAnnotation {
  id: string;
  type: AnnotationType;
  page: number;
  color: string;
  opacity: number;
  text?: string;
  thickness?: number;
  fontSize?: number;
  quads?: number[][];
  rect?: [number, number, number, number];
  line?: [number, number, number, number];
  points?: number[][][];
}

interface LineBox {
  x0: number;
  y0: number; // bottom
  x1: number;
  y1: number; // top
}

const COLOR_PRESETS = ["#ffff00", "#ff5252", "#4caf50", "#2196f3", "#ff9800", "#9c27b0", "#111111"];
const TOOLS: Tool[] = ["select", "highlight", "underline", "strikethrough", "comment", "textbox", "draw", "arrow", "rectangle", "ellipse", "erase"];
const NEEDS_COLOR: Tool[] = ["highlight", "underline", "strikethrough", "comment", "textbox", "draw", "arrow", "rectangle", "ellipse"];
const NEEDS_THICKNESS: Tool[] = ["draw", "arrow", "rectangle", "ellipse"];
const NEEDS_FONT_SIZE: Tool[] = ["textbox"];
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

const toolbarBtn = (active: boolean): CSSProperties => ({
  padding: "7px 11px",
  borderRadius: 8,
  border: active ? "1.5px solid var(--cs-accent)" : "1px solid var(--cs-line)",
  background: active ? "var(--cs-accent-soft)" : "transparent",
  color: active ? "var(--cs-accent)" : "var(--cs-text)",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  flex: "none",
});
const smallButton: CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const bigActionButton: CSSProperties = { width: "100%", height: 52, border: "none", borderRadius: 12, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButton: CSSProperties = { padding: "9px 14px", borderRadius: 9, border: "1.5px solid var(--cs-accent-line)", background: "transparent", color: "var(--cs-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normRect(a: [number, number], b: [number, number]): [number, number, number, number] {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

function quadForLine(l: LineBox): number[] {
  return [l.x0, l.y1, l.x1, l.y1, l.x0, l.y0, l.x1, l.y0];
}

export function AnnotateTool() {
  const t = useTranslations("annotateTool");
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
  const [color, setColor] = useState("#ffff00");
  const [opacity, setOpacity] = useState(1);
  const [thickness, setThickness] = useState(2);
  const [fontSize, setFontSize] = useState(14);

  const [annotations, setAnnotations] = useState<ClientAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const historyRef = useRef<ClientAnnotation[][]>([[]]);
  const historyIndexRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [dragCurrent, setDragCurrent] = useState<[number, number] | null>(null);
  const [drawStroke, setDrawStroke] = useState<[number, number][] | null>(null);
  const [textEditor, setTextEditor] = useState<{ id: string; kind: "comment" | "textbox"; screenX: number; screenY: number } | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; r2Key: string; size: number; annotationCount: number; loggedIn: boolean } | null>(null);
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

  const commit = useCallback((next: ClientAnnotation[], { debounce = false }: { debounce?: boolean } = {}) => {
    setAnnotations(next);
    const push = () => {
      const hist = historyRef.current.slice(0, historyIndexRef.current + 1);
      hist.push(next);
      historyRef.current = hist;
      historyIndexRef.current = hist.length - 1;
    };
    if (debounce) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(push, 500);
    } else {
      push();
    }
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setAnnotations(historyRef.current[historyIndexRef.current]);
  }, []);
  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setAnnotations(historyRef.current[historyIndexRef.current]);
  }, []);

  function deleteAnnotation(id: string) {
    commit(annotations.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  // --- Load PDF + render current page --------------------------------------
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
        const lines: LineBox[] = [];
        const buckets = new Map<number, LineBox>();
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
          if (!existing) buckets.set(key, { x0, x1: x0 + width, y0: bottom, y1: top });
          else {
            existing.x0 = Math.min(existing.x0, x0);
            existing.x1 = Math.max(existing.x1, x0 + width);
            existing.y0 = Math.min(existing.y0, bottom);
            existing.y1 = Math.max(existing.y1, top);
          }
        }
        for (const b of buckets.values()) lines.push(b);
        linesCacheRef.current.set(currentPage, lines);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, zoom, renderTick]);

  const displayZoom = zoom;
  const canvasW = pageSizePt.w * displayZoom;
  const canvasH = pageSizePt.h * displayZoom;

  function fitWidth() {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth - 4;
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cw / pageSizePt.w)));
  }
  function fitPage() {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth - 4;
    const ch = containerRef.current.clientHeight - 4;
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(cw / pageSizePt.w, ch / pageSizePt.h))));
  }

  const toPdf = useCallback(
    (screenX: number, screenY: number): [number, number] => [screenX / displayZoom, pageSizePt.h - screenY / displayZoom],
    [displayZoom, pageSizePt.h]
  );
  const toScreenX = useCallback((x: number) => x * displayZoom, [displayZoom]);
  const toScreenY = useCallback((y: number) => (pageSizePt.h - y) * displayZoom, [displayZoom, pageSizePt.h]);

  function eventToLocal(e: React.MouseEvent): [number, number] {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  // --- Pointer interactions --------------------------------------------------
  function handleOverlayMouseDown(e: React.MouseEvent) {
    if (disabled) return;
    if (tool === "select" || tool === "erase") return;
    const [sx, sy] = eventToLocal(e);
    const [px, py] = toPdf(sx, sy);

    if (tool === "comment" || tool === "textbox") {
      const id = uid();
      const rect: [number, number, number, number] = tool === "comment" ? [px, py - 18, px + 18, py] : [px, py - fontSize * 1.4, px + 220, py];
      const next: ClientAnnotation = { id, type: tool, page: currentPage, color, opacity, text: "", fontSize: tool === "textbox" ? fontSize : undefined, rect };
      commit([...annotations, next]);
      setSelectedId(id);
      setTextEditor({ id, kind: tool, screenX: sx, screenY: tool === "comment" ? sy - 18 * displayZoom : sy });
      return;
    }

    setDragStart([px, py]);
    setDragCurrent([px, py]);
    if (tool === "draw") setDrawStroke([[px, py]]);
  }

  function handleOverlayMouseMove(e: React.MouseEvent) {
    if (!dragStart) return;
    const [sx, sy] = eventToLocal(e);
    const [px, py] = toPdf(sx, sy);
    setDragCurrent([px, py]);
    if (tool === "draw" && drawStroke) {
      const last = drawStroke[drawStroke.length - 1];
      if (Math.hypot(px - last[0], py - last[1]) > 1.5 / displayZoom) {
        setDrawStroke([...drawStroke, [px, py]]);
      }
    }
  }

  function handleOverlayMouseUp() {
    if (!dragStart || !dragCurrent) return;
    const id = uid();

    if (tool === "draw" && drawStroke && drawStroke.length > 1) {
      commit([...annotations, { id, type: "draw", page: currentPage, color, opacity, thickness, points: [drawStroke] }]);
    } else if (tool === "arrow") {
      commit([...annotations, { id, type: "arrow", page: currentPage, color, opacity, thickness, line: [dragStart[0], dragStart[1], dragCurrent[0], dragCurrent[1]] }]);
    } else if (tool === "rectangle" || tool === "ellipse") {
      const rect = normRect(dragStart, dragCurrent);
      if (rect[2] - rect[0] > 2 && rect[3] - rect[1] > 2) {
        commit([...annotations, { id, type: tool, page: currentPage, color, opacity, thickness, rect }]);
      }
    } else if (tool === "highlight" || tool === "underline" || tool === "strikethrough") {
      const dragRect = normRect(dragStart, dragCurrent);
      const lines = linesCacheRef.current.get(currentPage) ?? [];
      const hit = lines.filter((l) => l.x1 >= dragRect[0] && l.x0 <= dragRect[2] && l.y1 >= dragRect[1] && l.y0 <= dragRect[3]);
      const quads = hit.length > 0 ? hit.map(quadForLine) : [quadForLine({ x0: dragRect[0], y0: dragRect[1], x1: dragRect[2], y1: dragRect[3] })];
      commit([...annotations, { id, type: tool, page: currentPage, color, opacity, quads }]);
    }

    setDragStart(null);
    setDragCurrent(null);
    setDrawStroke(null);
  }

  function commitTextEditor(text: string) {
    if (!textEditor) return;
    const trimmed = text;
    if (!trimmed.trim()) {
      commit(annotations.filter((a) => a.id !== textEditor.id));
    } else {
      commit(
        annotations.map((a) => (a.id === textEditor.id ? { ...a, text: trimmed } : a)),
        { debounce: true }
      );
    }
    setTextEditor(null);
  }

  // --- Keyboard shortcuts -----------------------------------------------------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const activeTag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === "Escape") setTool("select");
      else if (e.key.toLowerCase() === "h") setTool("highlight");
      else if (e.key.toLowerCase() === "t") setTool("textbox");
      else if (e.key.toLowerCase() === "d") setTool("draw");
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          deleteAnnotation(selectedId);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, annotations, undo, redo]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setResult(null);
    setError("");
    setAnnotations([]);
    historyRef.current = [[]];
    historyIndexRef.current = 0;
    setSelectedId(null);
  }

  async function handleSubmit() {
    if (!file) return;
    if (annotations.length === 0) {
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
      formData.append("config", JSON.stringify({ annotations: annotations.map((a) => ({ ...a, id: undefined })) }));

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/annotate");
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
        router.push("/login?redirect=/tools/annotate");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "annotate", plan: (json.plan as Plan) ?? "free" });
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
        annotationCount: (json.annotationCount as number) ?? 0,
        loggedIn: !!json.loggedIn,
      });
      setPhase("success");
      track("tool_used", { tool_name: "annotate", user_plan: (json.plan as Plan) ?? "free", file_size: file.size, success: true });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: "annotate" });
    fetch("/api/files/consumed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ r2Key: result.r2Key }) }).catch(() => {});
  }

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setError("");
    setDownloaded(false);
    setAnnotations([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(annotations, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annotations.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const pageAnnotations = useMemo(() => annotations.filter((a) => a.page === currentPage), [annotations, currentPage]);

  function renderShape(a: ClientAnnotation) {
    const onClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (tool === "erase") deleteAnnotation(a.id);
      else if (tool === "select") setSelectedId(a.id);
    };
    const selected = selectedId === a.id;
    const strokeSel = selected ? { strokeDasharray: "4 3", stroke: "var(--cs-accent)" } : {};

    switch (a.type) {
      case "highlight":
      case "underline":
      case "strikethrough": {
        if (!a.quads) return null;
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: tool === "select" || tool === "erase" ? "pointer" : "default" }}>
            {a.quads.map((q, i) => {
              const x0 = toScreenX(Math.min(q[0], q[4]));
              const x1 = toScreenX(Math.max(q[2], q[6]));
              const yTop = toScreenY(Math.max(q[1], q[3]));
              const yBot = toScreenY(Math.min(q[5], q[7]));
              if (a.type === "highlight") return <rect key={i} x={x0} y={yTop} width={x1 - x0} height={yBot - yTop} fill={a.color} opacity={a.opacity * 0.45} />;
              const lineY = a.type === "underline" ? yBot : (yTop + yBot) / 2;
              return <line key={i} x1={x0} y1={lineY} x2={x1} y2={lineY} stroke={a.color} strokeWidth={2} opacity={a.opacity} />;
            })}
          </g>
        );
      }
      case "comment": {
        if (!a.rect) return null;
        const x = toScreenX(a.rect[0]);
        const y = toScreenY(a.rect[3]);
        const size = toScreenX(a.rect[2]) - x;
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: "pointer" }}>
            <rect x={x} y={y} width={size} height={size} rx={3} fill={a.color} opacity={a.opacity} {...strokeSel} />
            <text x={x + size / 2} y={y + size / 2 + 4} textAnchor="middle" fontSize={12} fill="#111">
              💬
            </text>
          </g>
        );
      }
      case "textbox": {
        if (!a.rect) return null;
        const x = toScreenX(a.rect[0]);
        const y = toScreenY(a.rect[3]);
        const w = toScreenX(a.rect[2]) - x;
        const h = toScreenY(a.rect[1]) - y;
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: "pointer" }}>
            <rect x={x} y={y} width={w} height={h} fill="none" stroke={selected ? "var(--cs-accent)" : "transparent"} strokeDasharray="4 3" />
            <foreignObject x={x} y={y} width={w} height={h}>
              <div style={{ fontSize: (a.fontSize ?? 14) * displayZoom, color: a.color, opacity: a.opacity, fontFamily: "Arial, sans-serif", whiteSpace: "pre-wrap", lineHeight: 1.2 }}>{a.text}</div>
            </foreignObject>
          </g>
        );
      }
      case "draw": {
        if (!a.points) return null;
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: "pointer" }}>
            {a.points.map((stroke, i) => (
              <polyline
                key={i}
                points={stroke.map(([x, y]) => `${toScreenX(x)},${toScreenY(y)}`).join(" ")}
                fill="none"
                stroke={a.color}
                strokeWidth={(a.thickness ?? 2) * displayZoom}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={a.opacity}
              />
            ))}
          </g>
        );
      }
      case "arrow": {
        if (!a.line) return null;
        const [x1, y1, x2, y2] = a.line;
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: "pointer" }}>
            <defs>
              <marker id={`arrow-${a.id}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill={a.color} />
              </marker>
            </defs>
            <line x1={toScreenX(x1)} y1={toScreenY(y1)} x2={toScreenX(x2)} y2={toScreenY(y2)} stroke={a.color} strokeWidth={(a.thickness ?? 2) * displayZoom} opacity={a.opacity} markerEnd={`url(#arrow-${a.id})`} />
          </g>
        );
      }
      case "rectangle":
      case "ellipse": {
        if (!a.rect) return null;
        const x = toScreenX(a.rect[0]);
        const y = toScreenY(a.rect[3]);
        const w = toScreenX(a.rect[2]) - x;
        const h = toScreenY(a.rect[1]) - y;
        if (a.type === "rectangle") return <rect key={a.id} onClick={onClick} x={x} y={y} width={w} height={h} fill="none" stroke={a.color} strokeWidth={(a.thickness ?? 2) * displayZoom} opacity={a.opacity} style={{ cursor: "pointer" }} />;
        return <ellipse key={a.id} onClick={onClick} cx={x + w / 2} cy={y + h / 2} rx={Math.abs(w) / 2} ry={Math.abs(h) / 2} fill="none" stroke={a.color} strokeWidth={(a.thickness ?? 2) * displayZoom} opacity={a.opacity} style={{ cursor: "pointer" }} />;
      }
      default:
        return null;
    }
  }

  function renderDraft() {
    if (tool === "draw" && drawStroke) {
      return <polyline points={drawStroke.map(([x, y]) => `${toScreenX(x)},${toScreenY(y)}`).join(" ")} fill="none" stroke={color} strokeWidth={thickness * displayZoom} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
    }
    if (!dragStart || !dragCurrent) return null;
    if (tool === "arrow") {
      return <line x1={toScreenX(dragStart[0])} y1={toScreenY(dragStart[1])} x2={toScreenX(dragCurrent[0])} y2={toScreenY(dragCurrent[1])} stroke={color} strokeWidth={thickness * displayZoom} opacity={opacity} strokeDasharray="4 3" />;
    }
    const rect = normRect(dragStart, dragCurrent);
    const x = toScreenX(rect[0]);
    const y = toScreenY(rect[3]);
    const w = toScreenX(rect[2]) - x;
    const h = toScreenY(rect[1]) - y;
    if (tool === "rectangle" || tool === "highlight" || tool === "underline" || tool === "strikethrough") {
      return <rect x={x} y={y} width={w} height={h} fill={tool === "highlight" ? color : "none"} opacity={tool === "highlight" ? opacity * 0.35 : 1} stroke={tool === "highlight" ? "none" : color} strokeDasharray="4 3" />;
    }
    if (tool === "ellipse") {
      return <ellipse cx={x + w / 2} cy={y + h / 2} rx={Math.abs(w) / 2} ry={Math.abs(h) / 2} fill="none" stroke={color} strokeDasharray="4 3" />;
    }
    return null;
  }

  const annotationLabel = (a: ClientAnnotation) => a.text || t(`toolName.${a.type}`);

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
          <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600 }}>{t("resultHeadline", { count: result.annotationCount })}</div>
          <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>
            <div style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{result.filename}</div>
            <div style={{ marginTop: 3 }}>
              {formatBytes(result.size)}
              {processingSeconds !== null && ` · ${tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}`}
            </div>
            <div style={{ marginTop: 6 }}>{t("bakedIn")}</div>
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
          {/* Toolbar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-card)", padding: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TOOLS.map((tl) => (
                <button key={tl} type="button" style={toolbarBtn(tool === tl)} onClick={() => setTool(tl)} title={t(`toolName.${tl}`)}>
                  {t(`toolName.${tl}`)}
                </button>
              ))}
            </div>

            <div style={{ width: 1, alignSelf: "stretch", background: "var(--cs-line)" }} />

            {NEEDS_COLOR.includes(tool) && (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {COLOR_PRESETS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} style={{ width: 20, height: 20, borderRadius: 5, background: c, border: color === c ? "2px solid var(--cs-accent)" : "1px solid var(--cs-line)", cursor: "pointer" }} />
                ))}
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 28, height: 24, border: "1px solid var(--cs-line)", borderRadius: 6, padding: 0, background: "none" }} />
              </div>
            )}
            {NEEDS_COLOR.includes(tool) && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--cs-text-2)" }}>
                {t("opacityLabel")}
                <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ width: 70 }} />
              </label>
            )}
            {NEEDS_THICKNESS.includes(tool) && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--cs-text-2)" }}>
                {t("thicknessLabel")}
                <input type="range" min={1} max={10} value={thickness} onChange={(e) => setThickness(Number(e.target.value))} style={{ width: 70 }} />
              </label>
            )}
            {NEEDS_FONT_SIZE.includes(tool) && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--cs-text-2)" }}>
                {t("fontSizeLabel")}
                <input type="range" min={8} max={40} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: 70 }} />
              </label>
            )}

            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              <button type="button" style={smallButton} onClick={undo} title="Ctrl+Z">
                ↺
              </button>
              <button type="button" style={smallButton} onClick={redo} title="Ctrl+Shift+Z">
                ↻
              </button>
              <button type="button" style={smallButton} onClick={() => setSidebarOpen((v) => !v)}>
                {sidebarOpen ? t("hideSidebar") : t("showSidebar")}
              </button>
            </div>
          </div>

          {/* Page nav + zoom */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
              <button type="button" style={smallButton} disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                &larr;
              </button>
              <span>{t("pageOf", { current: currentPage, total: pageCount })}</span>
              <button type="button" style={smallButton} disabled={currentPage === pageCount} onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}>
                &rarr;
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
              <button type="button" style={smallButton} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))}>
                −
              </button>
              <span>{Math.round(displayZoom * 100)}%</span>
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
                <svg
                  width={canvasW}
                  height={canvasH}
                  style={{ position: "absolute", inset: 0, cursor: tool === "select" || tool === "erase" ? "default" : "crosshair" }}
                  onMouseDown={handleOverlayMouseDown}
                  onMouseMove={handleOverlayMouseMove}
                  onMouseUp={handleOverlayMouseUp}
                  onClick={() => tool === "select" && setSelectedId(null)}
                >
                  {pageAnnotations.map(renderShape)}
                  {renderDraft()}
                </svg>
                {textEditor && (
                  <textarea
                    autoFocus
                    defaultValue=""
                    onBlur={(e) => commitTextEditor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && textEditor.kind === "comment") {
                        e.preventDefault();
                        commitTextEditor((e.target as HTMLTextAreaElement).value);
                      }
                    }}
                    style={{
                      position: "absolute",
                      left: textEditor.screenX,
                      top: textEditor.screenY,
                      width: textEditor.kind === "comment" ? 180 : 220,
                      minHeight: textEditor.kind === "comment" ? 60 : fontSize * 1.6,
                      fontSize: textEditor.kind === "textbox" ? fontSize : 13,
                      color: textEditor.kind === "textbox" ? color : "#111",
                      border: "1.5px solid var(--cs-accent)",
                      borderRadius: 6,
                      padding: 4,
                      background: "var(--cs-card)",
                      fontFamily: "inherit",
                      resize: "both",
                      zIndex: 5,
                    }}
                    placeholder={t(textEditor.kind === "comment" ? "commentPlaceholder" : "textboxPlaceholder")}
                  />
                )}
              </div>
            </div>

            {sidebarOpen && (
              <div style={{ width: 260, flex: "none", border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-card)", padding: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: "70vh", overflow: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" }}>{t("annotationsHeading", { count: annotations.length })}</div>
                {annotations.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("noAnnotations")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {annotations.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => {
                          setCurrentPage(a.page);
                          setSelectedId(a.id);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: selectedId === a.id ? "var(--cs-accent-soft)" : "transparent", cursor: "pointer", fontSize: 12 }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flex: "none" }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t("sidebarItem", { page: a.page, label: annotationLabel(a) })}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAnnotation(a.id);
                          }}
                          style={{ border: "none", background: "none", color: "var(--cs-text-2)", cursor: "pointer", fontSize: 14, flex: "none" }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" style={smallButton} onClick={exportJson} disabled={annotations.length === 0}>
                  {t("exportJson")} <span style={{ color: "var(--cs-accent)", fontWeight: 700 }}>Pro</span>
                </button>
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

"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { loadPdfDocument } from "@/lib/tools/pdfjs-client";

type CropUnit = "mm" | "px" | "inches";
type CropMethod = "manual" | "preset" | "auto";
type CropPreset = "a4-portrait" | "a4-landscape" | "letter" | "square" | "custom";
type Side = "top" | "bottom" | "left" | "right";
type Phase = "idle" | "uploading" | "processing" | "success";

const PT_PER_MM = 2.83464567;
const MM_PER_PT = 1 / PT_PER_MM;
const PT_PER_INCH = 72;

function toPoints(value: number, unit: CropUnit): number {
  if (unit === "mm") return value * PT_PER_MM;
  if (unit === "inches") return value * PT_PER_INCH;
  return value;
}
function fromPoints(value: number, unit: CropUnit): number {
  if (unit === "mm") return value * MM_PER_PT;
  if (unit === "inches") return value / PT_PER_INCH;
  return value;
}
function mm(value: number): string {
  return (value * MM_PER_PT).toFixed(0);
}

const PRESET_SIZE_MM: Record<"a4-portrait" | "a4-landscape" | "letter", { w: number; h: number }> = {
  "a4-portrait": { w: 210, h: 297 },
  "a4-landscape": { w: 297, h: 210 },
  letter: { w: 215.9, h: 279.4 },
};

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const inputStyle: CSSProperties = { padding: "8px 9px", border: "1px solid var(--cs-line)", borderRadius: 8, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13, outline: "none", width: "100%" };
const bigActionButton: CSSProperties = { width: "100%", height: 52, border: "none", borderRadius: 12, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButton: CSSProperties = { padding: "9px 14px", borderRadius: 9, border: "1.5px solid var(--cs-accent-line)", background: "transparent", color: "var(--cs-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const smallButton: CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const tabButton = (active: boolean): CSSProperties => ({ flex: 1, padding: "9px 6px", borderRadius: 8, border: active ? "1.5px solid var(--cs-accent)" : "1px solid var(--cs-line)", background: active ? "var(--cs-accent-soft)" : "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });

export function CropTool() {
  const t = useTranslations("cropTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);

  const [pageCount, setPageCount] = useState(1);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [pageSizePt, setPageSizePt] = useState({ w: 595.28, h: 841.89 });
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  const [method, setMethod] = useState<CropMethod>("manual");
  const [unit, setUnit] = useState<CropUnit>("mm");
  const [marginsPt, setMarginsPt] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  const [preset, setPreset] = useState<CropPreset>("a4-portrait");
  const [customWidth, setCustomWidth] = useState(210);
  const [customHeight, setCustomHeight] = useState(297);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(false);
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([1]));

  const [dragging, setDragging] = useState<Side | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{
    downloadUrl: string; filename: string; r2Key: string; size: number; pagesCropped: number;
    margins: { top: number; bottom: number; left: number; right: number } | null;
    newSize: { width: number; height: number } | null; loggedIn: boolean;
  } | null>(null);
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

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await loadPdfDocument(file);
        if (cancelled) return;
        setPageCount(pdf.numPages);
        const page = await pdf.getPage(previewPageIndex + 1);
        const unscaled = page.getViewport({ scale: 1 });
        setPageSizePt({ w: unscaled.width, h: unscaled.height });
        const viewport = page.getViewport({ scale: 520 / unscaled.width });
        const canvas = pageCanvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setCanvasSize({ w: viewport.width, h: viewport.height });
        await page.render({ canvas, viewport }).promise;
      } catch {
        // Preview render is a UI aid only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, previewPageIndex]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setResult(null);
    setError("");
    setPreviewPageIndex(0);
  }

  const ptPerPxX = canvasSize.w > 0 ? pageSizePt.w / canvasSize.w : 1;
  const ptPerPxY = canvasSize.h > 0 ? pageSizePt.h / canvasSize.h : 1;

  function overlayMarginsPt(): { top: number; bottom: number; left: number; right: number } {
    if (method === "manual") return marginsPt;
    if (method === "auto") {
      const inset = Math.min(pageSizePt.w, pageSizePt.h) * 0.06;
      return { top: inset, bottom: inset, left: inset, right: inset };
    }
    const targetPt =
      preset === "square"
        ? { w: Math.min(pageSizePt.w, pageSizePt.h), h: Math.min(pageSizePt.w, pageSizePt.h) }
        : preset === "custom"
          ? { w: toPoints(customWidth, unit), h: toPoints(customHeight, unit) }
          : { w: PRESET_SIZE_MM[preset].w * PT_PER_MM, h: PRESET_SIZE_MM[preset].h * PT_PER_MM };
    const clampedW = Math.min(targetPt.w, pageSizePt.w);
    const clampedH = Math.min(targetPt.h, pageSizePt.h);
    const left = (pageSizePt.w - clampedW) / 2;
    const top = (pageSizePt.h - clampedH) / 2;
    return { top, bottom: pageSizePt.h - clampedH - top, left, right: pageSizePt.w - clampedW - left };
  }

  const overlay = overlayMarginsPt();
  const overlayPx = {
    top: overlay.top / ptPerPxY,
    bottom: overlay.bottom / ptPerPxY,
    left: overlay.left / ptPerPxX,
    right: overlay.right / ptPerPxX,
  };
  const afterW = pageSizePt.w - overlay.left - overlay.right;
  const afterH = pageSizePt.h - overlay.top - overlay.bottom;

  const handlePointerMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !previewBoxRef.current) return;
      const rect = previewBoxRef.current.getBoundingClientRect();
      setMarginsPt((prev) => {
        const next = { ...prev };
        if (dragging === "top") {
          const px = Math.max(0, Math.min(e.clientY - rect.top, rect.height - 1));
          next.top = px * ptPerPxY;
        } else if (dragging === "bottom") {
          const px = Math.max(0, Math.min(rect.bottom - e.clientY, rect.height - 1));
          next.bottom = px * ptPerPxY;
        } else if (dragging === "left") {
          const px = Math.max(0, Math.min(e.clientX - rect.left, rect.width - 1));
          next.left = px * ptPerPxX;
        } else if (dragging === "right") {
          const px = Math.max(0, Math.min(rect.right - e.clientX, rect.width - 1));
          next.right = px * ptPerPxX;
        }
        return next;
      });
    },
    [dragging, ptPerPxX, ptPerPxY]
  );

  useEffect(() => {
    if (!dragging) return;
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, handlePointerMove]);

  function togglePage(n: number) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  async function handleSubmit() {
    if (!file) return;
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    const applyTo: "all" | number[] = applyToAll ? "all" : Array.from(selectedPages).sort((a, b) => a - b);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "config",
        JSON.stringify({
          method,
          margins: method === "manual" ? { ...marginsPt, unit: "px" } : undefined,
          preset: method === "preset" ? preset : undefined,
          customSize: method === "preset" && preset === "custom" ? { width: customWidth, height: customHeight, unit } : undefined,
          applyTo,
          maintainAspectRatio,
        })
      );

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/crop");
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
        router.push("/login?redirect=/tools/crop");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "crop", plan: (json.plan as Plan) ?? "free" });
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
        pagesCropped: (json.pagesCropped as number) ?? 0,
        margins: (json.margins as { top: number; bottom: number; left: number; right: number } | null) ?? null,
        newSize: (json.newSize as { width: number; height: number } | null) ?? null,
        loggedIn: !!json.loggedIn,
      });
      setPhase("success");
      track("tool_used", { tool_name: "crop", user_plan: (json.plan as Plan) ?? "free", file_size: file.size, success: true });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: "crop" });
    fetch("/api/files/consumed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ r2Key: result.r2Key }) }).catch(() => {});
  }

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setError("");
    setDownloaded(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="split-workspace">
      <div className="split-columns">
        <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: "clamp(18px,2.5vw,26px)", display: "flex", flexDirection: "column", gap: 14, minHeight: 260 }}>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

          {!file ? (
            <div
              style={{ border: "1.5px dashed var(--cs-accent-line)", borderRadius: 16, background: "var(--cs-accent-soft)", padding: "40px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
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
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                <button type="button" style={smallButton} onClick={() => inputRef.current?.click()} disabled={disabled}>
                  {tc("chooseAnotherFile")}
                </button>
              </div>

              {pageCount > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 12.5 }}>
                  <button type="button" style={smallButton} disabled={previewPageIndex === 0} onClick={() => setPreviewPageIndex((i) => Math.max(0, i - 1))}>
                    &larr;
                  </button>
                  <span>{t("pageOf", { current: previewPageIndex + 1, total: pageCount })}</span>
                  <button type="button" style={smallButton} disabled={previewPageIndex === pageCount - 1} onClick={() => setPreviewPageIndex((i) => Math.min(pageCount - 1, i + 1))}>
                    &rarr;
                  </button>
                </div>
              )}

              <div ref={previewBoxRef} style={{ position: "relative", display: "inline-block", alignSelf: "center", border: "1px solid var(--cs-line)", borderRadius: 8, overflow: "hidden", touchAction: "none" }}>
                <canvas ref={pageCanvasRef} style={{ display: "block" }} />

                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: overlayPx.top, background: "rgba(0,0,0,0.45)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: overlayPx.bottom, background: "rgba(0,0,0,0.45)" }} />
                <div style={{ position: "absolute", top: overlayPx.top, bottom: overlayPx.bottom, left: 0, width: overlayPx.left, background: "rgba(0,0,0,0.45)" }} />
                <div style={{ position: "absolute", top: overlayPx.top, bottom: overlayPx.bottom, right: 0, width: overlayPx.right, background: "rgba(0,0,0,0.45)" }} />

                {method === "manual" && (
                  <>
                    <div onMouseDown={() => setDragging("top")} style={{ position: "absolute", top: overlayPx.top - 3, left: 0, right: 0, height: 6, cursor: "row-resize", background: "var(--cs-accent)" }} />
                    <div onMouseDown={() => setDragging("bottom")} style={{ position: "absolute", bottom: overlayPx.bottom - 3, left: 0, right: 0, height: 6, cursor: "row-resize", background: "var(--cs-accent)" }} />
                    <div onMouseDown={() => setDragging("left")} style={{ position: "absolute", left: overlayPx.left - 3, top: 0, bottom: 0, width: 6, cursor: "col-resize", background: "var(--cs-accent)" }} />
                    <div onMouseDown={() => setDragging("right")} style={{ position: "absolute", right: overlayPx.right - 3, top: 0, bottom: 0, width: 6, cursor: "col-resize", background: "var(--cs-accent)" }} />
                  </>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 18, fontSize: 12, color: "var(--cs-text-2)" }}>
                <span>{t("originalSize", { size: `${mm(pageSizePt.w)}×${mm(pageSizePt.h)}mm` })}</span>
                <span>{t("afterCropSize", { size: `${mm(afterW)}×${mm(afterH)}mm` })}</span>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {phase === "success" && result ? (
            <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center", flex: "none" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </motion.div>
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600 }}>{t("resultHeadline")}</div>
              <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>
                <div style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{result.filename}</div>
                <div style={{ marginTop: 3 }}>{formatBytes(result.size)}</div>
                {result.margins && (
                  <div style={{ marginTop: 6 }}>
                    {t("marginsRemoved", {
                      top: result.margins.top.toFixed(0),
                      bottom: result.margins.bottom.toFixed(0),
                      left: result.margins.left.toFixed(0),
                      right: result.margins.right.toFixed(0),
                    })}
                  </div>
                )}
                {result.newSize && <div style={{ marginTop: 3 }}>{t("newSize", { width: result.newSize.width.toFixed(0), height: result.newSize.height.toFixed(0) })}</div>}
                {processingSeconds !== null && <div style={{ marginTop: 3 }}>{tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}</div>}
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
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={tabButton(method === "manual")} onClick={() => setMethod("manual")} disabled={disabled}>
                  {t("tab.manual")}
                </button>
                <button type="button" style={tabButton(method === "preset")} onClick={() => setMethod("preset")} disabled={disabled}>
                  {t("tab.preset")}
                </button>
                <button type="button" style={tabButton(method === "auto")} onClick={() => setMethod("auto")} disabled={disabled}>
                  {t("tab.auto")}
                </button>
              </div>

              {method === "manual" && (
                <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={sectionTitle}>{t("manualHeading")}</div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <select value={unit} onChange={(e) => setUnit(e.target.value as CropUnit)} disabled={disabled} style={{ ...inputStyle, width: "auto" }}>
                      <option value="mm">mm</option>
                      <option value="px">px</option>
                      <option value="inches">{t("unit.inches")}</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {(["top", "bottom", "left", "right"] as Side[]).map((side) => (
                      <label key={side} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                        {t(`margin.${side}`)}
                        <input
                          type="number"
                          min={0}
                          value={fromPoints(marginsPt[side], unit).toFixed(1)}
                          disabled={disabled}
                          onChange={(e) => setMarginsPt((prev) => ({ ...prev, [side]: toPoints(Number(e.target.value) || 0, unit) }))}
                          style={inputStyle}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {method === "preset" && (
                <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={sectionTitle}>{t("presetHeading")}</div>
                  {(["a4-portrait", "a4-landscape", "letter", "square", "custom"] as CropPreset[]).map((p) => (
                    <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input type="radio" name="preset" checked={preset === p} disabled={disabled} onChange={() => setPreset(p)} style={{ accentColor: "var(--cs-accent)" }} />
                      {t(`preset.${p}`)}
                    </label>
                  ))}
                  {preset === "custom" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                        {t("widthLabel")}
                        <input type="number" min={1} value={customWidth} onChange={(e) => setCustomWidth(Number(e.target.value) || 1)} style={inputStyle} disabled={disabled} />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                        {t("heightLabel")}
                        <input type="number" min={1} value={customHeight} onChange={(e) => setCustomHeight(Number(e.target.value) || 1)} style={inputStyle} disabled={disabled} />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {method === "auto" && (
                <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={sectionTitle}>✨ {t("autoHeading")}</div>
                  <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("autoDescription")}</div>
                </div>
              )}

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={sectionTitle}>{t("optionsHeading")}</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="radio" name="applyAll" checked={applyToAll} disabled={disabled} onChange={() => setApplyToAll(true)} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("applyAllPages")}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="radio" name="applyAll" checked={!applyToAll} disabled={disabled} onChange={() => setApplyToAll(false)} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("applySelectedPages")}
                </label>
                {!applyToAll && pageCount > 1 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => togglePage(n)}
                        disabled={disabled}
                        style={{ ...smallButton, minWidth: 30, background: selectedPages.has(n) ? "var(--cs-accent-soft)" : "transparent", borderColor: selectedPages.has(n) ? "var(--cs-accent)" : "var(--cs-line)" }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 4 }}>
                  <input type="checkbox" checked={maintainAspectRatio} onChange={(e) => setMaintainAspectRatio(e.target.checked)} disabled={disabled} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("maintainAspectRatio")}
                </label>
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
                  {t("cropButton")} &rarr;
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

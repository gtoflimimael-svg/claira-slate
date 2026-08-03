"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { loadPdfDocument } from "@/lib/tools/pdfjs-client";

type Tab = "draw" | "type" | "upload";
type Phase = "idle" | "uploading" | "processing" | "success";
type ApplyMode = "current" | "all" | "custom";

const HANDWRITING_FONTS = ["'Brush Script MT', cursive", "'Segoe Script', cursive", "'Lucida Handwriting', cursive", "cursive", "'Comic Sans MS', cursive"];
const PEN_COLORS = ["#111111", "#1d4ed8", "#b91c1c"];

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const inputStyle: CSSProperties = { padding: "9px 10px", border: "1px solid var(--cs-line)", borderRadius: 8, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13.5, outline: "none", width: "100%" };
const bigActionButton: CSSProperties = { width: "100%", height: 52, border: "none", borderRadius: 12, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButton: CSSProperties = { padding: "9px 14px", borderRadius: 9, border: "1.5px solid var(--cs-accent-line)", background: "transparent", color: "var(--cs-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const smallButton: CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const tabButton = (active: boolean): CSSProperties => ({ padding: "8px 14px", borderRadius: 9, border: "none", background: active ? "var(--cs-accent-soft)" : "transparent", color: active ? "var(--cs-accent)" : "var(--cs-text-2)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });

function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

export function SignTool() {
  const t = useTranslations("signTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);

  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pageRenderSize, setPageRenderSize] = useState({ w: 0, h: 0 });
  const [pagePointSize, setPagePointSize] = useState({ w: 612, h: 792 });

  const [tab, setTab] = useState<Tab>("draw");
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [typedName, setTypedName] = useState("");
  const [typedFont, setTypedFont] = useState(HANDWRITING_FONTS[0]);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [sigAspect, setSigAspect] = useState(2.5);

  const [sigPos, setSigPos] = useState({ xPct: 0.5, yPct: 0.8 }); // fraction of page render size, top-left origin
  const [sigWidthPt, setSigWidthPt] = useState(160);
  const [opacity, setOpacity] = useState(1);
  const [applyMode, setApplyMode] = useState<ApplyMode>("current");
  const [customPages, setCustomPages] = useState("");
  const [addDateStamp, setAddDateStamp] = useState(false);
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; r2Key: string; size: number; pagesSigned: number; loggedIn: boolean } | null>(null);
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

  // Render the current page.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await loadPdfDocument(file);
        if (cancelled) return;
        setNumPages(pdf.numPages);
        const page = await pdf.getPage(Math.min(pageIndex + 1, pdf.numPages));
        const pointViewport = page.getViewport({ scale: 1 });
        setPagePointSize({ w: pointViewport.width, h: pointViewport.height });
        const scale = 560 / pointViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = pageCanvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setPageRenderSize({ w: viewport.width, h: viewport.height });
        await page.render({ canvas, viewport }).promise;
      } catch {
        // Page render is a UI aid only — submission still works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, pageIndex]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setPageIndex(0);
    setResult(null);
    setError("");
  }

  function clearDrawCanvas() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }
  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }
  function endDraw() {
    drawing.current = false;
  }

  function useDrawnSignature() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    setSignatureDataUrl(canvasToPngDataUrl(canvas));
    setSigAspect(canvas.width / canvas.height);
  }

  function useTypedSignature() {
    if (!typedName.trim()) return;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111111";
    ctx.font = `64px ${typedFont}`;
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, 20, canvas.height / 2);
    setSignatureDataUrl(canvasToPngDataUrl(canvas));
    setSigAspect(canvas.width / canvas.height);
  }

  function onUploadFile(f: File | null) {
    if (!f) return;
    setUploadedFile(f);
    const url = URL.createObjectURL(f);
    setUploadedUrl(url);
    const img = new Image();
    img.onload = () => setSigAspect(img.naturalWidth / img.naturalHeight);
    img.src = url;
    // Convert to data URL for submission (object URLs aren't valid outside the browser tab).
    const reader = new FileReader();
    reader.onload = () => setSignatureDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  }

  function onDragSignature(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const container = pageCanvasRef.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const xPct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const yPct = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
      setSigPos({ xPct, yPct });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function handleSubmit() {
    if (!file || !signatureDataUrl) return;
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    const widthPt = sigWidthPt;
    const heightPt = widthPt / sigAspect;
    const xPt = sigPos.xPct * pagePointSize.w - widthPt / 2;
    const yPt = sigPos.yPct * pagePointSize.h - heightPt / 2;

    let pagePlacement: number | "all" | number[] = "all";
    if (applyMode === "current") pagePlacement = pageIndex + 1;
    else if (applyMode === "custom") {
      pagePlacement = customPages
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n) && n >= 1);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "config",
        JSON.stringify({
          signatureData: signatureDataUrl,
          placement: { page: pagePlacement, x: xPt, y: yPt, width: widthPt, height: heightPt, opacity },
          addDateStamp,
          dateFormat,
        })
      );

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/sign");
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
        router.push("/login?redirect=/tools/sign");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "sign", plan: (json.plan as Plan) ?? "free" });
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
        pagesSigned: (json.pagesSigned as number) ?? 1,
        loggedIn: !!json.loggedIn,
      });
      setPhase("success");
      track("tool_used", { tool_name: "sign", user_plan: (json.plan as Plan) ?? "free", file_size: file.size, success: true });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: "sign" });
  }

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setError("");
    setDownloaded(false);
    setSignatureDataUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const sigWidthPx = pageRenderSize.w > 0 ? (sigWidthPt / pagePointSize.w) * pageRenderSize.w : 0;
  const sigHeightPx = sigWidthPx / sigAspect;

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

              <div style={{ position: "relative", display: "inline-block", alignSelf: "center", border: "1px solid var(--cs-line)", borderRadius: 8, overflow: "hidden" }}>
                <canvas ref={pageCanvasRef} style={{ display: "block" }} />
                {signatureDataUrl && pageRenderSize.w > 0 && (
                  <div
                    onPointerDown={onDragSignature}
                    style={{
                      position: "absolute",
                      left: sigPos.xPct * pageRenderSize.w - sigWidthPx / 2,
                      top: sigPos.yPct * pageRenderSize.h - sigHeightPx / 2,
                      width: sigWidthPx,
                      height: sigHeightPx,
                      cursor: "grab",
                      touchAction: "none",
                      opacity,
                      border: "1px dashed var(--cs-accent)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signatureDataUrl} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
                  </div>
                )}
              </div>

              {numPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <button type="button" style={smallButton} disabled={pageIndex === 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
                    ←
                  </button>
                  <span style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("pageOf", { current: pageIndex + 1, total: numPages })}</span>
                  <button type="button" style={smallButton} disabled={pageIndex === numPages - 1} onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))}>
                    →
                  </button>
                </div>
              )}
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
                <div style={{ marginTop: 3 }}>
                  {formatBytes(result.size)} · {t("pagesSigned", { count: result.pagesSigned })}
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
              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--cs-line)", paddingBottom: 10 }}>
                  {(["draw", "type", "upload"] as Tab[]).map((tb) => (
                    <button key={tb} type="button" style={tabButton(tab === tb)} onClick={() => setTab(tb)} disabled={disabled}>
                      {t(`tab.${tb}`)}
                    </button>
                  ))}
                </div>

                {tab === "draw" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <canvas
                      ref={drawCanvasRef}
                      width={400}
                      height={140}
                      style={{ width: "100%", height: 140, borderRadius: 10, border: "1px solid var(--cs-line)", background: "#fff", touchAction: "none", cursor: "crosshair" }}
                      onPointerDown={startDraw}
                      onPointerMove={moveDraw}
                      onPointerUp={endDraw}
                      onPointerLeave={endDraw}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {PEN_COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setPenColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: penColor === c ? "2px solid var(--cs-accent)" : "1px solid var(--cs-line)", cursor: "pointer" }} aria-label={c} />
                      ))}
                      <button type="button" style={{ ...smallButton, marginLeft: "auto" }} onClick={clearDrawCanvas}>
                        {t("clearButton")}
                      </button>
                    </div>
                    <button type="button" style={ghostButton} onClick={useDrawnSignature}>
                      {t("useSignatureButton")}
                    </button>
                  </div>
                )}

                {tab === "type" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input type="text" value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={t("yourNamePlaceholder")} style={inputStyle} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {HANDWRITING_FONTS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setTypedFont(f)}
                          style={{ textAlign: "left", padding: "8px 12px", borderRadius: 8, border: typedFont === f ? "1.5px solid var(--cs-accent)" : "1px solid var(--cs-line)", background: typedFont === f ? "var(--cs-accent-soft)" : "transparent", fontFamily: f, fontSize: 20, cursor: "pointer" }}
                        >
                          {typedName || t("yourNamePlaceholder")}
                        </button>
                      ))}
                    </div>
                    <button type="button" style={ghostButton} onClick={useTypedSignature}>
                      {t("useSignatureButton")}
                    </button>
                  </div>
                )}

                {tab === "upload" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input type="file" accept="image/png,image/jpeg" onChange={(e) => onUploadFile(e.target.files?.[0] ?? null)} style={inputStyle} />
                    {uploadedUrl && uploadedFile && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={uploadedUrl} alt="" style={{ maxWidth: "100%", maxHeight: 100, objectFit: "contain", background: "var(--cs-bg-2)", borderRadius: 8 }} />
                    )}
                  </div>
                )}
              </div>

              {signatureDataUrl && (
                <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={sectionTitle}>{t("propertiesHeading")}</div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                    {t("sizeLabel")}
                    <input type="range" min={60} max={320} value={sigWidthPt} onChange={(e) => setSigWidthPt(Number(e.target.value))} disabled={disabled} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                    {t("opacityLabel")}
                    <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} disabled={disabled} />
                  </label>

                  <div style={sectionTitle}>{t("applyToHeading")}</div>
                  {(["current", "all", "custom"] as ApplyMode[]).map((m) => (
                    <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input type="radio" name="applyMode" checked={applyMode === m} disabled={disabled} onChange={() => setApplyMode(m)} style={{ accentColor: "var(--cs-accent)" }} />
                      {t(`applyTo.${m}`)}
                    </label>
                  ))}
                  {applyMode === "custom" && <input type="text" value={customPages} onChange={(e) => setCustomPages(e.target.value)} placeholder="1, 3, 5" style={inputStyle} disabled={disabled} />}

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={addDateStamp} disabled={disabled} onChange={(e) => setAddDateStamp(e.target.checked)} style={{ accentColor: "var(--cs-accent)" }} />
                    {t("dateStampLabel")}
                  </label>
                  {addDateStamp && (
                    <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} style={inputStyle} disabled={disabled}>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  )}
                </div>
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
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tp("processingHeadline")}</div>
                </div>
              )}
              {phase === "idle" && (
                <button type="button" style={bigActionButton} onClick={handleSubmit} disabled={!file || !signatureDataUrl}>
                  {t("addSignatureButton")} &rarr;
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

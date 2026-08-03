"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { loadPdfDocument } from "@/lib/tools/pdfjs-client";

type ColorChoice = "black" | "white" | "custom";
type Phase = "idle" | "uploading" | "processing" | "success";

interface Box {
  id: string;
  page: number; // 0-indexed
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  color: string;
}

interface PageInfo {
  canvasW: number;
  canvasH: number;
  pointW: number;
  pointH: number;
}

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const inputStyle: CSSProperties = { padding: "9px 10px", border: "1px solid var(--cs-line)", borderRadius: 8, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13.5, outline: "none", width: "100%" };
const bigActionButton: CSSProperties = { width: "100%", height: 52, border: "none", borderRadius: 12, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButton: CSSProperties = { padding: "9px 14px", borderRadius: 9, border: "1.5px solid var(--cs-accent-line)", background: "transparent", color: "var(--cs-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const smallButton: CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const proBadge: CSSProperties = { padding: "1px 6px", borderRadius: 6, background: "var(--cs-accent)", color: "#fff", fontSize: 9.5, fontWeight: 700 };

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `b${Date.now()}-${Math.random()}`;
}

const COLOR_FOR: Record<Exclude<ColorChoice, "custom">, string> = { black: "#000000", white: "#ffffff" };

export function RedactTool() {
  const t = useTranslations("redactTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);

  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const draftRef = useRef<{ page: number; startX: number; startY: number } | null>(null);
  const [draftBox, setDraftBox] = useState<{ page: number; x: number; y: number; w: number; h: number } | null>(null);

  const [colorChoice, setColorChoice] = useState<ColorChoice>("black");
  const [customColor, setCustomColor] = useState("#ff0000");
  const [removeUnderlyingText, setRemoveUnderlyingText] = useState(true);
  const [removeMetadata, setRemoveMetadata] = useState(false);

  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiEmails, setAiEmails] = useState(true);
  const [aiPhones, setAiPhones] = useState(true);
  const [aiNames, setAiNames] = useState(false);
  const [aiDates, setAiDates] = useState(false);
  const [aiCreditCards, setAiCreditCards] = useState(false);
  const [aiSsn, setAiSsn] = useState(false);
  const [aiCustomPattern, setAiCustomPattern] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; r2Key: string; size: number; redactionCount: number; loggedIn: boolean } | null>(null);
  const [processingSeconds, setProcessingSeconds] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = resultDeadline ? Math.max(0, Math.round((resultDeadline - now) / 1000)) : 3600;

  const disabled = phase !== "idle";
  const currentColor = colorChoice === "custom" ? customColor : COLOR_FOR[colorChoice];

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
        const infos: PageInfo[] = [];
        canvasRefs.current = new Array(pdf.numPages).fill(null);
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const pointViewport = page.getViewport({ scale: 1 });
          const scale = 640 / pointViewport.width;
          const viewport = page.getViewport({ scale });
          infos.push({ canvasW: viewport.width, canvasH: viewport.height, pointW: pointViewport.width, pointH: pointViewport.height });
        }
        if (cancelled) return;
        setPageInfos(infos);
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const info = infos[i - 1];
          const canvas = canvasRefs.current[i - 1];
          if (!canvas || cancelled) return;
          canvas.width = info.canvasW;
          canvas.height = info.canvasH;
          await page.render({ canvas, viewport: page.getViewport({ scale: info.canvasW / info.pointW }) }).promise;
        }
      } catch {
        // Page render is a UI aid only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setBoxes([]);
    setPageInfos([]);
    setResult(null);
    setError("");
  }

  function startDrawing(pageIndex: number, e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    draftRef.current = { page: pageIndex, startX: x, startY: y };
    setDraftBox({ page: pageIndex, x, y, w: 0, h: 0 });

    const move = (ev: PointerEvent) => {
      const cur = draftRef.current;
      if (!cur) return;
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      setDraftBox({ page: cur.page, x: Math.min(cur.startX, cx), y: Math.min(cur.startY, cy), w: Math.abs(cx - cur.startX), h: Math.abs(cy - cur.startY) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const info = pageInfos[pageIndex];
      const cur = draftRef.current;
      draftRef.current = null;
      setDraftBox((d) => {
        if (d && info && d.w > 8 && d.h > 8) {
          setBoxes((prev) => [
            ...prev,
            { id: genId(), page: cur!.page, xPct: d.x / info.canvasW, yPct: d.y / info.canvasH, wPct: d.w / info.canvasW, hPct: d.h / info.canvasH, color: currentColor },
          ]);
        }
        return null;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function removeBox(id: string) {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
  }

  const pagesWithBoxes = new Set(boxes.map((b) => b.page)).size;

  async function handleSubmit() {
    if (!file) return;
    if (boxes.length === 0 && !aiEnabled) {
      setError(t("noRedactionsError"));
      return;
    }
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    const redactions = boxes.map((b) => {
      const info = pageInfos[b.page];
      return {
        page: b.page + 1,
        x: b.xPct * info.pointW,
        y: b.yPct * info.pointH,
        width: b.wPct * info.pointW,
        height: b.hPct * info.pointH,
        color: b.color,
      };
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "config",
        JSON.stringify({
          redactions,
          removeUnderlyingText,
          removeMetadata,
          aiRedact: aiEnabled
            ? { emails: aiEmails, phones: aiPhones, names: aiNames, dates: aiDates, creditCards: aiCreditCards, ssn: aiSsn, customPattern: aiCustomPattern || undefined }
            : undefined,
        })
      );

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/redact");
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
        router.push("/login?redirect=/tools/redact");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "redact", plan: (json.plan as Plan) ?? "free" });
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
        redactionCount: (json.redactionCount as number) ?? boxes.length,
        loggedIn: !!json.loggedIn,
      });
      setPhase("success");
      track("tool_used", { tool_name: "redact", user_plan: (json.plan as Plan) ?? "free", file_size: file.size, success: true });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: "redact" });
  }

  function reset() {
    setFile(null);
    setBoxes([]);
    setPageInfos([]);
    setResult(null);
    setPhase("idle");
    setError("");
    setDownloaded(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="split-workspace">
      <div className="split-columns">
        <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: "clamp(18px,2.5vw,26px)", display: "flex", flexDirection: "column", gap: 14, minHeight: 260, maxHeight: 720, overflowY: file ? "auto" : "visible" }}>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--cs-card)", zIndex: 2, paddingBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                <button type="button" style={smallButton} onClick={() => inputRef.current?.click()} disabled={disabled}>
                  {tc("chooseAnotherFile")}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--cs-text-2)", textAlign: "center" }}>{t("drawHint")}</div>

              {pageInfos.map((info, pageIndex) => (
                <div key={pageIndex} style={{ position: "relative", alignSelf: "center", border: "1px solid var(--cs-line)", borderRadius: 8, overflow: "hidden", touchAction: "none" }}>
                  <canvas ref={(el) => { canvasRefs.current[pageIndex] = el; }} style={{ display: "block", width: "100%" }} />
                  <div
                    style={{ position: "absolute", inset: 0, cursor: disabled ? "default" : "crosshair" }}
                    onPointerDown={(e) => startDrawing(pageIndex, e)}
                  >
                    {boxes
                      .filter((b) => b.page === pageIndex)
                      .map((b) => (
                        <div
                          key={b.id}
                          style={{ position: "absolute", left: `${b.xPct * 100}%`, top: `${b.yPct * 100}%`, width: `${b.wPct * 100}%`, height: `${b.hPct * 100}%`, background: b.color, opacity: 0.85, border: "1px solid rgba(255,255,255,.4)" }}
                        >
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => removeBox(b.id)}
                            aria-label={tp("removeFile")}
                            style={{ position: "absolute", top: -8, right: -8, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(20,20,32,.8)", color: "#fff", cursor: "pointer", fontSize: 11, lineHeight: 1 }}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    {draftBox && draftBox.page === pageIndex && (
                      <div style={{ position: "absolute", left: draftBox.x, top: draftBox.y, width: draftBox.w, height: draftBox.h, background: currentColor, opacity: 0.5 }} />
                    )}
                  </div>
                  <div style={{ position: "absolute", bottom: 4, right: 6, fontSize: 10.5, color: "#fff", background: "rgba(0,0,0,.5)", padding: "1px 6px", borderRadius: 6 }}>{pageIndex + 1}</div>
                </div>
              ))}
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
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600 }}>{t("resultHeadline", { count: result.redactionCount })}</div>
              <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>
                <div style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{result.filename}</div>
                <div style={{ marginTop: 3 }}>
                  {formatBytes(result.size)}
                  {processingSeconds !== null && ` · ${tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}`}
                </div>
                <div style={{ marginTop: 6 }}>{t("textPermanentlyRemoved")}</div>
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
              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={sectionTitle}>{t("colorHeading")}</div>
                {(["black", "white", "custom"] as ColorChoice[]).map((c) => (
                  <label key={c} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="radio" name="redactColor" checked={colorChoice === c} disabled={disabled} onChange={() => setColorChoice(c)} style={{ accentColor: "var(--cs-accent)" }} />
                    {t(`color.${c}`)}
                    {c === "custom" && colorChoice === "custom" && (
                      <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} disabled={disabled} style={{ width: 28, height: 22, border: "1px solid var(--cs-line)", borderRadius: 4, padding: 0, background: "none" }} />
                    )}
                  </label>
                ))}
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={sectionTitle}>{t("optionsHeading")}</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={removeUnderlyingText} disabled={disabled} onChange={(e) => setRemoveUnderlyingText(e.target.checked)} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("removeUnderlyingTextLabel")}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={removeMetadata} disabled={disabled} onChange={(e) => setRemoveMetadata(e.target.checked)} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("removeMetadataLabel")}
                </label>
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                  <input type="checkbox" checked={aiEnabled} disabled={disabled} onChange={(e) => setAiEnabled(e.target.checked)} style={{ accentColor: "var(--cs-accent)" }} />
                  ✨ {t("aiRedactHeading")}
                  <span style={proBadge}>PRO</span>
                </label>
                {aiEnabled && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 4 }}>
                    {[
                      { checked: aiEmails, onChange: setAiEmails, label: t("ai.emails") },
                      { checked: aiPhones, onChange: setAiPhones, label: t("ai.phones") },
                      { checked: aiNames, onChange: setAiNames, label: t("ai.names") },
                      { checked: aiDates, onChange: setAiDates, label: t("ai.dates") },
                      { checked: aiCreditCards, onChange: setAiCreditCards, label: t("ai.creditCards") },
                      { checked: aiSsn, onChange: setAiSsn, label: t("ai.ssn") },
                    ].map((opt) => (
                      <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <input type="checkbox" checked={opt.checked} disabled={disabled} onChange={(e) => opt.onChange(e.target.checked)} style={{ accentColor: "var(--cs-accent)" }} />
                        {opt.label}
                      </label>
                    ))}
                    <input type="text" value={aiCustomPattern} onChange={(e) => setAiCustomPattern(e.target.value)} placeholder={t("ai.customPatternPlaceholder")} style={inputStyle} disabled={disabled} />
                  </div>
                )}
              </div>

              {(boxes.length > 0 || aiEnabled) && (
                <div style={{ fontSize: 12.5, color: "var(--cs-text-2)", textAlign: "center" }}>
                  {boxes.length > 0 ? t("redactionCount", { count: boxes.length, pages: pagesWithBoxes }) : t("aiRedactPending")}
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
                <button type="button" style={bigActionButton} onClick={handleSubmit} disabled={!file}>
                  {t("redactButton")} &rarr;
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

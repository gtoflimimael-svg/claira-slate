"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { loadPdfDocument } from "@/lib/tools/pdfjs-client";

type Position = "TL" | "TC" | "TR" | "ML" | "MC" | "MR" | "BL" | "BC" | "BR";
type NumberFormat = "numeric" | "with-total" | "roman" | "alpha" | "custom";
type ApplyTo = "all" | "skip-first" | "custom";
type FontFamily = "helvetica" | "times" | "courier" | "helvetica-oblique";
type Phase = "idle" | "uploading" | "processing" | "success";

const FONT_CSS: Record<FontFamily, string> = { helvetica: "Arial, sans-serif", times: "'Times New Roman', serif", courier: "'Courier New', monospace", "helvetica-oblique": "Arial, sans-serif" };
const POSITIONS: Position[] = ["TL", "TC", "TR", "ML", "MC", "MR", "BL", "BC", "BR"];
const FORMATS: NumberFormat[] = ["numeric", "with-total", "roman", "alpha", "custom"];

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const inputStyle: CSSProperties = { padding: "9px 10px", border: "1px solid var(--cs-line)", borderRadius: 8, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13.5, outline: "none", width: "100%" };
const bigActionButton: CSSProperties = { width: "100%", height: 52, border: "none", borderRadius: 12, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButton: CSSProperties = { padding: "9px 14px", borderRadius: 9, border: "1.5px solid var(--cs-accent-line)", background: "transparent", color: "var(--cs-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const smallButton: CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };

function positionStyle(pos: Position): CSSProperties {
  const justify = pos[1] === "L" ? "flex-start" : pos[1] === "R" ? "flex-end" : "center";
  const align = pos[0] === "T" ? "flex-start" : pos[0] === "B" ? "flex-end" : "center";
  return { display: "flex", justifyContent: justify, alignItems: align };
}

function previewLabel(format: NumberFormat, customPrefix: string, startFrom: number): string {
  switch (format) {
    case "with-total":
      return `Page ${startFrom} of N`;
    case "roman":
      return "i";
    case "alpha":
      return "A";
    case "custom":
      return `${customPrefix}${startFrom}`;
    default:
      return String(startFrom);
  }
}

export function NumberPagesTool() {
  const t = useTranslations("numberPagesTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);

  const [position, setPosition] = useState<Position>("BC");
  const [format, setFormat] = useState<NumberFormat>("numeric");
  const [customPrefix, setCustomPrefix] = useState("Page ");
  const [startFrom, setStartFrom] = useState(1);
  const [applyTo, setApplyTo] = useState<ApplyTo>("all");
  const [customPages, setCustomPages] = useState("");
  const [fontSize, setFontSize] = useState(12);
  const [fontFamily, setFontFamily] = useState<FontFamily>("helvetica");
  const [color, setColor] = useState("#111111");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [margin, setMargin] = useState(20);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; r2Key: string; size: number; pagesNumbered: number; loggedIn: boolean } | null>(null);
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
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 560 / page.getViewport({ scale: 1 }).width });
        const canvas = pageCanvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
      } catch {
        // Preview render is a UI aid only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setResult(null);
    setError("");
  }

  async function handleSubmit() {
    if (!file) return;
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    let applyToValue: "all" | "skip-first" | number[] = "all";
    if (applyTo === "skip-first") applyToValue = "skip-first";
    else if (applyTo === "custom") {
      applyToValue = customPages
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
          position,
          format,
          customPrefix,
          startFrom,
          applyTo: applyToValue,
          style: { fontSize, fontFamily, color, bold, italic },
          margin,
        })
      );

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/number-pages");
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
        router.push("/login?redirect=/tools/number-pages");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "number-pages", plan: (json.plan as Plan) ?? "free" });
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
        pagesNumbered: (json.pagesNumbered as number) ?? 0,
        loggedIn: !!json.loggedIn,
      });
      setPhase("success");
      track("tool_used", { tool_name: "number-pages", user_plan: (json.plan as Plan) ?? "free", file_size: file.size, success: true });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: "number-pages" });
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
              <div style={{ fontSize: 11.5, color: "var(--cs-text-2)", textAlign: "center" }}>{t("previewLabel")}</div>
              <div style={{ position: "relative", display: "inline-block", alignSelf: "center", border: "1px solid var(--cs-line)", borderRadius: 8, overflow: "hidden" }}>
                <canvas ref={pageCanvasRef} style={{ display: "block" }} />
                <div style={{ position: "absolute", inset: 12, ...positionStyle(position) }}>
                  <div style={{ color, fontSize: fontSize * 1.3, fontFamily: FONT_CSS[fontFamily], fontWeight: bold ? 700 : 400, fontStyle: italic || fontFamily === "helvetica-oblique" ? "italic" : "normal" }}>
                    {previewLabel(format, customPrefix, startFrom)}
                  </div>
                </div>
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
                <div style={{ marginTop: 3 }}>
                  {formatBytes(result.size)} · {t("pagesNumbered", { count: result.pagesNumbered })}
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
              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={sectionTitle}>{t("positionHeading")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, maxWidth: 160 }}>
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setPosition(pos)}
                      disabled={disabled}
                      style={{ height: 36, borderRadius: 8, border: position === pos ? "2px solid var(--cs-accent)" : "1px solid var(--cs-line)", background: position === pos ? "var(--cs-accent-soft)" : "transparent", cursor: "pointer" }}
                      aria-label={pos}
                    />
                  ))}
                </div>
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={sectionTitle}>{t("formatHeading")}</div>
                {FORMATS.map((f) => (
                  <label key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="radio" name="format" checked={format === f} disabled={disabled} onChange={() => setFormat(f)} style={{ accentColor: "var(--cs-accent)" }} />
                    {t(`format.${f}`)}
                  </label>
                ))}
                {format === "custom" && <input type="text" value={customPrefix} onChange={(e) => setCustomPrefix(e.target.value)} placeholder="Page " style={inputStyle} disabled={disabled} />}

                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)", marginTop: 6 }}>
                  {t("startFromLabel")}
                  <input type="number" min={0} value={startFrom} onChange={(e) => setStartFrom(Math.max(0, parseInt(e.target.value, 10) || 0))} style={inputStyle} disabled={disabled} />
                </label>
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={sectionTitle}>{t("applyToHeading")}</div>
                {(["all", "skip-first", "custom"] as ApplyTo[]).map((m) => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="radio" name="applyTo" checked={applyTo === m} disabled={disabled} onChange={() => setApplyTo(m)} style={{ accentColor: "var(--cs-accent)" }} />
                    {t(`applyTo.${m}`)}
                  </label>
                ))}
                {applyTo === "custom" && <input type="text" value={customPages} onChange={(e) => setCustomPages(e.target.value)} placeholder="1, 3, 5" style={inputStyle} disabled={disabled} />}
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={sectionTitle}>{t("styleHeading")}</div>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                  {t("fontSizeLabel", { size: fontSize })}
                  <input type="range" min={8} max={24} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} disabled={disabled} />
                </label>
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value as FontFamily)} style={inputStyle} disabled={disabled}>
                  <option value="helvetica">{t("font.helvetica")}</option>
                  <option value="times">{t("font.times")}</option>
                  <option value="courier">{t("font.courier")}</option>
                  <option value="helvetica-oblique">{t("font.helveticaOblique")}</option>
                </select>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={disabled} style={{ width: 40, height: 32, border: "1px solid var(--cs-line)", borderRadius: 6, padding: 0, background: "none" }} />
                  <button type="button" onClick={() => setBold((b) => !b)} style={{ ...smallButton, fontWeight: 700, background: bold ? "var(--cs-accent-soft)" : "transparent", borderColor: bold ? "var(--cs-accent)" : "var(--cs-line)" }}>
                    B
                  </button>
                  <button type="button" onClick={() => setItalic((i) => !i)} style={{ ...smallButton, fontStyle: "italic", background: italic ? "var(--cs-accent-soft)" : "transparent", borderColor: italic ? "var(--cs-accent)" : "var(--cs-line)" }}>
                    I
                  </button>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--cs-text-2)" }}>
                  {t("marginLabel", { margin })}
                  <input type="range" min={5} max={50} value={margin} onChange={(e) => setMargin(Number(e.target.value))} disabled={disabled} />
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
                  {t("addNumbersButton")} &rarr;
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

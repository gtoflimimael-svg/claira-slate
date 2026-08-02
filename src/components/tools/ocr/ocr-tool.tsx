"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { loadPdfDocument } from "@/lib/tools/pdfjs-client";

type Quality = "fast" | "balanced" | "precise";
type OutputMode = "searchable" | "text-visible";
type Phase = "idle" | "processing" | "success";
type PreviewTab = "before" | "after";

const LANGUAGES = ["eng", "fra", "spa", "deu", "ara", "chi_sim", "jpn", "hin", "kor", "rus", "por", "ita"] as const;
type LangCode = (typeof LANGUAGES)[number];

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const inputStyle: CSSProperties = { padding: "9px 10px", border: "1px solid var(--cs-line)", borderRadius: 8, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13.5, outline: "none", width: "100%" };
const bigActionButton: CSSProperties = { width: "100%", height: 52, border: "none", borderRadius: 12, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButton: CSSProperties = { padding: "9px 14px", borderRadius: 9, border: "1.5px solid var(--cs-accent-line)", background: "transparent", color: "var(--cs-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const smallButton: CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const tabButton = (active: boolean): CSSProperties => ({ flex: 1, padding: "9px 6px", borderRadius: 8, border: active ? "1.5px solid var(--cs-accent)" : "1px solid var(--cs-line)", background: active ? "var(--cs-accent-soft)" : "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });

export function OcrTool() {
  const t = useTranslations("ocrToolV2");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);
  const beforeCanvasRef = useRef<HTMLCanvasElement>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement>(null);

  const [pageCount, setPageCount] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("before");
  const [afterBuffer, setAfterBuffer] = useState<ArrayBuffer | null>(null);

  const [multiLang, setMultiLang] = useState(false);
  const [singleLang, setSingleLang] = useState<"" | LangCode>("");
  const [multiLangCodes, setMultiLangCodes] = useState<LangCode[]>([]);
  const [quality, setQuality] = useState<Quality>("balanced");
  const [outputMode, setOutputMode] = useState<OutputMode>("searchable");
  const [correctSkew, setCorrectSkew] = useState(true);
  const [removeNoise, setRemoveNoise] = useState(false);
  const [detectTables, setDetectTables] = useState(false);
  const [generateTextFile, setGenerateTextFile] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [ocrPage, setOcrPage] = useState(0);
  const [ocrTotal, setOcrTotal] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{
    downloadUrl: string; filename: string; r2Key: string; size: number; pages: number;
    averageConfidence: number; languagesUsed: string[]; textDownloadUrl?: string; textFilename?: string; loggedIn: boolean;
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
        const page = await pdf.getPage(previewPage);
        const viewport = page.getViewport({ scale: 480 / page.getViewport({ scale: 1 }).width });
        const canvas = beforeCanvasRef.current;
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
  }, [file, previewPage]);

  useEffect(() => {
    if (!afterBuffer) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const pdf = await pdfjsLib.getDocument({ data: afterBuffer.slice(0) }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(previewPage);
        const viewport = page.getViewport({ scale: 480 / page.getViewport({ scale: 1 }).width });
        const canvas = afterCanvasRef.current;
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
  }, [afterBuffer, previewPage]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setResult(null);
    setError("");
    setPreviewPage(1);
    setPreviewTab("before");
    setAfterBuffer(null);
  }

  function toggleMultiLangCode(code: LangCode) {
    setMultiLangCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= 3) return prev;
      return [...prev, code];
    });
  }

  async function handleSubmit() {
    if (!file) return;
    setError("");
    setPhase("processing");
    setOcrPage(0);
    setOcrTotal(0);
    setEtaSeconds(null);
    startTimeRef.current = Date.now();

    const languages = multiLang ? multiLangCodes : singleLang ? [singleLang] : [];

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("config", JSON.stringify({ languages, quality, outputMode, correctSkew, removeNoise, detectTables, generateTextFile }));

      const response = await fetch("/api/tools/ocr", { method: "POST", body: formData });

      if (response.status === 401) {
        router.push("/login?redirect=/tools/ocr");
        return;
      }

      // Quota/plan/validation failures return a single plain JSON error
      // object (not the NDJSON progress stream) before OCR ever starts.
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (response.status === 429) {
          setLimit((json.limit as number) ?? 5);
          setPhase("idle");
          track("quota_limit_reached", { feature: "ocr", plan: (json.plan as Plan) ?? "free" });
          return;
        }
        setError((json.error as string) || tc("error"));
        setPhase("idle");
        return;
      }

      if (!response.body) {
        setError(tc("couldntReachServer"));
        setPhase("idle");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line) as Record<string, unknown>;
          if (evt.type === "progress") {
            const page = evt.page as number;
            const total = evt.total as number;
            setOcrPage(page);
            setOcrTotal(total);
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            const perPage = elapsed / page;
            setEtaSeconds(Math.max(0, Math.round(perPage * (total - page))));
          } else if (evt.type === "done") {
            setProcessingSeconds((Date.now() - startTimeRef.current) / 1000);
            setNow(Date.now());
            setResultDeadline(Date.now() + 3600_000);
            setResult({
              downloadUrl: evt.downloadUrl as string,
              filename: evt.filename as string,
              r2Key: evt.r2Key as string,
              size: (evt.size as number) ?? 0,
              pages: (evt.pages as number) ?? 0,
              averageConfidence: (evt.averageConfidence as number) ?? 0,
              languagesUsed: (evt.languagesUsed as string[]) ?? [],
              textDownloadUrl: evt.textDownloadUrl as string | undefined,
              textFilename: evt.textFilename as string | undefined,
              loggedIn: !!evt.loggedIn,
            });
            setPhase("success");
            track("tool_used", { tool_name: "ocr", user_plan: (evt.plan as Plan) ?? "free", file_size: file.size, success: true });

            fetch(evt.downloadUrl as string)
              .then((r) => r.arrayBuffer())
              .then((buf) => setAfterBuffer(buf))
              .catch(() => {});
          } else if (evt.type === "error") {
            setError((evt.error as string) || tc("error"));
            setPhase("idle");
          }
        }
      }
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload(url: string, tool: string) {
    window.location.href = url;
    if (tool === "ocr") setDownloaded(true);
    track("file_downloaded", { tool_name: tool });
  }

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setError("");
    setDownloaded(false);
    setAfterBuffer(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const detectedLanguageLabels = result?.languagesUsed.map((code) => (LANGUAGES.includes(code as LangCode) ? t(`language.${code}`) : code)).join(", ");

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

              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={tabButton(previewTab === "before")} onClick={() => setPreviewTab("before")}>
                  {t("beforeTab")}
                </button>
                <button type="button" style={tabButton(previewTab === "after")} onClick={() => afterBuffer && setPreviewTab("after")} disabled={!afterBuffer}>
                  {t("afterTab")}
                </button>
              </div>

              <div style={{ position: "relative", display: "inline-block", alignSelf: "center", border: "1px solid var(--cs-line)", borderRadius: 8, overflow: "hidden", minHeight: 100 }}>
                <canvas ref={beforeCanvasRef} style={{ display: previewTab === "before" ? "block" : "none" }} />
                <canvas ref={afterCanvasRef} style={{ display: previewTab === "after" ? "block" : "none" }} />
                {previewTab === "after" && !afterBuffer && <div style={{ padding: 30, fontSize: 12.5, color: "var(--cs-text-2)" }}>{t("afterNotReady")}</div>}
              </div>

              {pageCount > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 12.5 }}>
                  <button type="button" style={smallButton} disabled={previewPage === 1} onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}>
                    &larr;
                  </button>
                  <span>{t("pageOf", { current: previewPage, total: pageCount })}</span>
                  <button type="button" style={smallButton} disabled={previewPage === pageCount} onClick={() => setPreviewPage((p) => Math.min(pageCount, p + 1))}>
                    &rarr;
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
                  {formatBytes(result.size)} · {t("pagesProcessed", { count: result.pages })}
                </div>
                <div style={{ marginTop: 3 }}>{t("accuracy", { pct: Math.round(result.averageConfidence) })}</div>
                {detectedLanguageLabels && <div style={{ marginTop: 3 }}>{t("languagesDetected", { languages: detectedLanguageLabels })}</div>}
                {processingSeconds !== null && <div style={{ marginTop: 3 }}>{tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}</div>}
              </div>
              <button type="button" className="hover-text" style={bigActionButton} onClick={() => handleDownload(result.downloadUrl, "ocr")}>
                {downloaded ? tc("downloaded") : tc("download")} &darr;
              </button>
              {result.textDownloadUrl && (
                <button type="button" style={ghostButton} onClick={() => handleDownload(result.textDownloadUrl!, "ocr-text")}>
                  {t("downloadTextFile")}
                </button>
              )}
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
                <div style={sectionTitle}>{t("languageHeading")}</div>
                {!multiLang ? (
                  <select value={singleLang} onChange={(e) => setSingleLang(e.target.value as "" | LangCode)} style={inputStyle} disabled={disabled}>
                    <option value="">{t("language.auto")}</option>
                    {LANGUAGES.map((code) => (
                      <option key={code} value={code}>
                        {t(`language.${code}`)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {LANGUAGES.map((code) => (
                      <button
                        key={code}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleMultiLangCode(code)}
                        style={{ ...smallButton, background: multiLangCodes.includes(code) ? "var(--cs-accent-soft)" : "transparent", borderColor: multiLangCodes.includes(code) ? "var(--cs-accent)" : "var(--cs-line)" }}
                      >
                        {t(`language.${code}`)}
                      </button>
                    ))}
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={multiLang} onChange={(e) => setMultiLang(e.target.checked)} disabled={disabled} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("multiLanguageToggle")}
                </label>
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={sectionTitle}>{t("qualityHeading")}</div>
                {(["fast", "balanced", "precise"] as Quality[]).map((q) => (
                  <label key={q} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="radio" name="quality" checked={quality === q} disabled={disabled} onChange={() => setQuality(q)} style={{ accentColor: "var(--cs-accent)" }} />
                    {t(`quality.${q}`)}
                    {q === "precise" && <span style={{ color: "var(--cs-accent)", fontWeight: 700, fontSize: 11 }}>Pro</span>}
                  </label>
                ))}
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={sectionTitle}>{t("outputHeading")}</div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                  <input type="radio" name="outputMode" checked={outputMode === "searchable"} disabled={disabled} onChange={() => setOutputMode("searchable")} style={{ accentColor: "var(--cs-accent)", marginTop: 3 }} />
                  <span>
                    {t("output.searchable")}
                    <br />
                    <span style={{ fontSize: 11.5, color: "var(--cs-text-2)" }}>{t("output.searchableHint")}</span>
                  </span>
                </label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                  <input type="radio" name="outputMode" checked={outputMode === "text-visible"} disabled={disabled} onChange={() => setOutputMode("text-visible")} style={{ accentColor: "var(--cs-accent)", marginTop: 3 }} />
                  <span>
                    {t("output.textVisible")}
                    <br />
                    <span style={{ fontSize: 11.5, color: "var(--cs-text-2)" }}>{t("output.textVisibleHint")}</span>
                  </span>
                </label>
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={sectionTitle}>{t("optionsHeading")}</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={correctSkew} onChange={(e) => setCorrectSkew(e.target.checked)} disabled={disabled} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("correctSkew")}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={removeNoise} onChange={(e) => setRemoveNoise(e.target.checked)} disabled={disabled} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("removeNoise")}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={detectTables} onChange={(e) => setDetectTables(e.target.checked)} disabled={disabled} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("detectTables")}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={generateTextFile} onChange={(e) => setGenerateTextFile(e.target.checked)} disabled={disabled} style={{ accentColor: "var(--cs-accent)" }} />
                  {t("generateTextFile")}
                </label>
              </div>

              {phase === "processing" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", padding: "8px 0" }}>
                  <div className="cs-spinner" />
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{ocrTotal > 0 ? t("processingPage", { page: ocrPage, total: ocrTotal }) : tp("processingHeadline")}</div>
                  {etaSeconds !== null && <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t("etaRemaining", { seconds: etaSeconds })}</div>}
                  {ocrTotal > 0 && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {Array.from({ length: ocrTotal }, (_, i) => (
                        <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < ocrPage ? "var(--cs-accent)" : "var(--cs-line)" }} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {phase === "idle" && (
                <button type="button" style={bigActionButton} onClick={handleSubmit} disabled={!file}>
                  {t("runOcrButton")} &rarr;
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

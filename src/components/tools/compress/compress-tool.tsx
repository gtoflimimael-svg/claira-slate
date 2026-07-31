"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { FileThumbnail } from "@/components/tools/file-thumbnail";

type Level = "extreme" | "recommended" | "less";
type Phase = "idle" | "uploading" | "processing" | "success";

const LEVEL_QUALITY: Record<Level, number> = { extreme: 30, recommended: 60, less: 85 };
const LEVEL_ICON: Record<Level, string> = { extreme: "🗜️", recommended: "⚖️", less: "🔍" };
const LEVELS: Level[] = ["extreme", "recommended", "less"];

interface SourceFile {
  id: string;
  file: File;
  pageCount: number | null;
}

interface OutputFile {
  filename: string;
  r2Key: string;
  downloadUrl: string;
  originalSize: number;
  size: number;
  pages: number;
}

interface CompressResult {
  files: OutputFile[];
  zip: { downloadUrl: string; r2Key: string; filename: string } | null;
  loggedIn: boolean;
}

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c${Date.now()}-${Math.random()}`;
}

// Rough, deterministic size-reduction estimate shown live in the panel —
// the actual result panel always reports the real achieved size, per spec.
function estimateMultiplier(level: Level, customQuality: number | null): number {
  if (customQuality !== null) return 0.15 + ((customQuality - 10) * (0.95 - 0.15)) / 90;
  return { extreme: 0.2, recommended: 0.475, less: 0.8 }[level];
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const cardBase: CSSProperties = {
  border: "1.5px solid var(--cs-line)",
  borderRadius: 14,
  padding: 14,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  transition: "border-color .15s ease, background .15s ease",
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

export function CompressTool() {
  const t = useTranslations("compressTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const originalPreviewRef = useRef<{ canvas: HTMLCanvasElement } | null>(null);

  const [sources, setSources] = useState<SourceFile[]>([]);
  const [level, setLevel] = useState<Level>("recommended");
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customQuality, setCustomQuality] = useState(75);
  const [showCustomNudge, setShowCustomNudge] = useState(false);
  const [hoveredLevel, setHoveredLevel] = useState<Level | null>(null);

  const [previewOriginal, setPreviewOriginal] = useState<string | null>(null);
  const [previewCompressed, setPreviewCompressed] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUpgradeLimit, setAiUpgradeLimit] = useState<number | null>(null);
  const [aiBanner, setAiBanner] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = resultDeadline ? Math.max(0, Math.round((resultDeadline - now) / 1000)) : 3600;

  const disabled = phase !== "idle";
  const effectiveQuality = customEnabled ? customQuality : LEVEL_QUALITY[level];
  const totalOriginalBytes = sources.reduce((sum, s) => sum + s.file.size, 0);
  const multiplier = estimateMultiplier(level, customEnabled ? customQuality : null);
  const estimatedBytes = Math.round(totalOriginalBytes * multiplier);
  const estimatedPct = Math.round((1 - multiplier) * 100);

  useEffect(() => {
    if (!resultDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resultDeadline]);

  function pickFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (incoming.length === 0) return;
    setSources((prev) => [...prev, ...incoming.map((file) => ({ id: genId(), file, pageCount: null as number | null }))]);
    setResult(null);
    setError("");
  }

  function removeSource(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  function resetAll() {
    setSources([]);
    setResult(null);
    setResultDeadline(null);
    setError("");
    setPhase("idle");
    setAiBanner(null);
    setAiError(null);
    setAiUpgradeLimit(null);
    setPreviewOriginal(null);
    setPreviewCompressed(null);
    originalPreviewRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  function toggleCustom() {
    // Custom quality is a paid-plan feature (server-enforced); free users
    // always see the same "upgrade" nudge on interaction here, matching
    // Split's existing Smart-mode Pro-stub pattern rather than guessing the
    // user's plan client-side.
    setShowCustomNudge(true);
    setCustomEnabled((v) => !v);
  }

  // --- Quality preview: render the first uploaded file's first page once,
  // then re-encode that same bitmap at the current quality whenever level/
  // custom quality changes — a real (not simulated) JPEG re-encode, just done
  // client-side for an instant before/after without a server round-trip.
  useEffect(() => {
    const first = sources[0];
    if (!first) {
      // No setState here: `sources.length === 0` already renders the
      // empty-state branch instead of the JSX that reads these preview
      // values, and the next file added re-runs this effect (new id) and
      // overwrites them anyway — clearing them here would just be an
      // avoidable synchronous setState call inside an effect body.
      originalPreviewRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const buffer = await first.file.arrayBuffer();
        if (cancelled) return;
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvas, viewport }).promise;
        if (cancelled) return;
        originalPreviewRef.current = { canvas };
        setPreviewOriginal(canvas.toDataURL("image/jpeg", 0.95));
        setPreviewCompressed(canvas.toDataURL("image/jpeg", Math.max(0.05, effectiveQuality / 100)));
      } catch {
        originalPreviewRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length > 0 ? sources[0].id : null]);

  useEffect(() => {
    const cached = originalPreviewRef.current;
    if (!cached) return;
    setPreviewCompressed(cached.canvas.toDataURL("image/jpeg", Math.max(0.05, effectiveQuality / 100)));
  }, [effectiveQuality]);

  // --- AI Optimize ---------------------------------------------------------
  async function handleAiOptimize() {
    if (sources.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiUpgradeLimit(null);
    setAiBanner(null);
    try {
      const formData = new FormData();
      sources.forEach((s) => formData.append("file", s.file));
      const res = await fetch("/api/ai/compress-suggest", { method: "POST", body: formData });
      const json = await res.json();

      if (res.status === 429) {
        setAiUpgradeLimit(json.limit ?? 5);
        return;
      }
      if (!res.ok) {
        setAiError(json.error || tc("error"));
        return;
      }

      setLevel(json.level as Level);
      setCustomEnabled(false);
      setAiBanner(json.reasoning as string);
      track("tool_used", { tool_name: "compress-ai", user_plan: (json.plan as Plan) ?? "free", file_size: 0, success: true });
    } catch {
      setAiError(tc("couldntReachServer"));
    } finally {
      setAiLoading(false);
    }
  }

  // --- Submit -------------------------------------------------------------
  async function handleCompress() {
    if (sources.length === 0) return;
    setError("");
    setPhase("uploading");
    setUploadProgress(0);

    const config = { level, quality: customEnabled ? customQuality : undefined };

    try {
      const formData = new FormData();
      sources.forEach((s) => formData.append("file", s.file));
      formData.append("config", JSON.stringify(config));

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/compress");
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
        router.push("/login?redirect=/tools/compress");
        return;
      }
      if (status === 403 && customEnabled) {
        setCustomEnabled(false);
        setError((json.error as string) || t("customProError"));
        setPhase("idle");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "compress", plan: (json.plan as Plan) ?? "free" });
        return;
      }
      if (status < 200 || status >= 300) {
        setError((json.error as string) || tc("error"));
        setPhase("idle");
        return;
      }

      setResult({ files: json.files as OutputFile[], zip: json.zip as CompressResult["zip"], loggedIn: !!json.loggedIn });
      // This runs inside an XHR completion callback within an async function
      // invoked only from a button's onClick — never during render — same
      // as the identical Date.now() pattern in organize-tool.tsx/
      // rotate-tool.tsx's success handlers, which this rule doesn't flag.
      // eslint-disable-next-line react-hooks/purity
      setNow(Date.now());
      // eslint-disable-next-line react-hooks/purity
      setResultDeadline(Date.now() + 3600_000);
      setPhase("success");
      track("tool_used", {
        tool_name: "compress",
        user_plan: (json.plan as Plan) ?? "free",
        file_size: totalOriginalBytes,
        success: true,
      });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  const compressLabel = useMemo(() => {
    if (phase === "uploading") return tp("uploadingFiles", { count: sources.length });
    if (phase === "processing") return t("compressingCount", { count: sources.length });
    return t("compressButton");
  }, [phase, sources.length, t, tp]);

  // --- Empty state ----------------------------------------------------------
  if (sources.length === 0) {
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

  return (
    <div className="split-workspace">
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: "none" }} onChange={(e) => pickFiles(e.target.files)} />
      <div className="split-columns">
        {/* LEFT: files */}
        <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: "clamp(18px,2.5vw,26px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("filesHeading", { count: sources.length })}</div>
            <button type="button" className="hover-text" style={{ ...smallButton, border: "none", padding: "4px 6px", color: "var(--cs-text-2)" }} onClick={resetAll} disabled={disabled}>
              {t("resetAll")}
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {sources.map((s) => (
              <div key={s.id} className="tool-file-card" style={{ borderRadius: 12, background: "var(--cs-card)", border: "1px solid var(--cs-line)", position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => removeSource(s.id)}
                  aria-label={t("removeFile")}
                  disabled={disabled}
                  style={{ position: "absolute", top: 6, right: 6, zIndex: 2, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(20,20,32,.6)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 13, lineHeight: 1 }}
                >
                  &times;
                </button>
                <div style={{ flex: "1 1 auto", background: "var(--cs-bg-2)", display: "grid", placeItems: "center", overflow: "hidden" }}>
                  <FileThumbnail file={s.file} isPdf onPageCount={(n) => setSources((prev) => prev.map((x) => (x.id === s.id ? { ...x, pageCount: n } : x)))} />
                </div>
                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid var(--cs-line)" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s.file.name}>
                    {s.file.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--cs-text-2)" }}>
                    {formatBytes(s.file.size)}
                    {s.pageCount ? ` · ${s.pageCount} p.` : ""}
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="hover-text"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              style={{ width: 160, height: 200, borderRadius: 12, border: "1.5px dashed var(--cs-accent-line)", background: "var(--cs-accent-soft)", color: "var(--cs-accent)", fontSize: 28, cursor: "pointer", display: "grid", placeItems: "center" }}
              aria-label={t("addMoreFiles")}
            >
              +
            </button>
          </div>

          {previewOriginal && previewCompressed && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 10 }}>{t("qualityPreviewHeading")}</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px", textAlign: "center" }}>
                  <div style={{ fontSize: 11.5, color: "var(--cs-text-2)", marginBottom: 6 }}>{t("original")}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewOriginal} alt="" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--cs-line)" }} />
                </div>
                <div style={{ flex: "1 1 160px", textAlign: "center" }}>
                  <div style={{ fontSize: 11.5, color: "var(--cs-text-2)", marginBottom: 6 }}>{t("afterCompression")}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewCompressed} alt="" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--cs-line)" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: config / result */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {phase === "success" && result ? (
            <ResultPanel result={result} secondsLeft={secondsLeft} onReset={resetAll} t={t} />
          ) : (
            <>
              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" }}>{t("levelHeading")}</div>
                {LEVELS.map((lv) => {
                  const selected = !customEnabled && level === lv;
                  const borderColor = selected ? "var(--cs-accent)" : hoveredLevel === lv ? "var(--cs-accent-line)" : "var(--cs-line)";
                  return (
                    <div
                      key={lv}
                      style={{
                        ...cardBase,
                        borderColor,
                        background: selected ? "var(--cs-accent-soft)" : "transparent",
                      }}
                      onClick={() => {
                        setLevel(lv);
                        setCustomEnabled(false);
                      }}
                      onMouseEnter={() => setHoveredLevel(lv)}
                      onMouseLeave={() => setHoveredLevel((prev) => (prev === lv ? null : prev))}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                        <span>{LEVEL_ICON[lv]}</span>
                        <span>{t(`level.${lv}.name`)}</span>
                        {selected && (
                          <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 12.5l5 5L20 6.5" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t(`level.${lv}.desc`)}</div>
                      <div style={{ fontSize: 11.5, color: "var(--cs-accent)", fontWeight: 500 }}>{t(`level.${lv}.reduction`)}</div>
                    </div>
                  );
                })}

                <div style={{ borderTop: "1px solid var(--cs-line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={customEnabled} onChange={toggleCustom} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                    {t("customQualityLabel")}
                    <span style={{ padding: "1px 6px", borderRadius: 6, background: "var(--cs-accent)", color: "#fff", fontSize: 9.5, fontWeight: 700 }}>PRO</span>
                  </label>
                  {customEnabled && (
                    <>
                      <input type="range" min={10} max={100} value={customQuality} onChange={(e) => setCustomQuality(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--cs-accent)" }} />
                      <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{t("qualityEstimate", { quality: customQuality, reduction: estimatedPct })}</div>
                    </>
                  )}
                  {showCustomNudge && (
                    <div style={{ padding: 10, borderRadius: 10, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      {t("customProNudge")}
                      <Link href="/pricing" style={{ padding: "7px 12px", borderRadius: 8, background: "var(--cs-accent)", color: "#fff", fontSize: 12, fontWeight: 500, textDecoration: "none", textAlign: "center", width: "fit-content" }}>
                        {t("upgrade")}
                      </Link>
                    </div>
                  )}
                </div>

                <button type="button" style={{ ...smallButton, justifyContent: "center", borderColor: "var(--cs-accent)", color: "var(--cs-accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }} onClick={handleAiOptimize} disabled={aiLoading}>
                  {aiLoading ? t("aiAnalyzing") : `✨ ${t("aiOptimize")}`}
                  <span style={{ padding: "1px 6px", borderRadius: 6, background: "var(--cs-accent)", color: "#fff", fontSize: 9.5, fontWeight: 700 }}>PRO</span>
                </button>
                {aiBanner && <div style={{ fontSize: 12, color: "var(--cs-text)" }}>{aiBanner}</div>}
                {aiError && <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{aiError}</div>}
                {aiUpgradeLimit !== null && (
                  <div style={{ fontSize: 12 }}>
                    {t("aiQuotaMessage", { limit: aiUpgradeLimit })}{" "}
                    <Link href="/pricing" style={{ color: "var(--cs-accent)" }}>
                      {t("upgrade")}
                    </Link>
                  </div>
                )}
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 4 }}>{t("estimatedHeading")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--cs-text-2)" }}>{t("original")}</span>
                  <span>{formatBytes(totalOriginalBytes)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--cs-text-2)" }}>{t("estimated")}</span>
                  <span>~{formatBytes(estimatedBytes)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "var(--cs-accent)" }}>
                  <span>{t("reduction")}</span>
                  <span>~{estimatedPct}% 🎉</span>
                </div>
              </div>

              {phase === "uploading" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", padding: "8px 0" }}>
                  <div className="cs-spinner" />
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("compressingCount", { count: sources.length })}</div>
                </div>
              )}

              {phase === "idle" && (
                <button type="button" style={bigActionButton} onClick={handleCompress} disabled={sources.length === 0}>
                  {compressLabel} &rarr;
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
    </div>
  );
}

function ResultPanel({ result, secondsLeft, onReset, t }: { result: CompressResult; secondsLeft: number; onReset: () => void; t: ReturnType<typeof useTranslations> }) {
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");

  const totalOriginal = result.files.reduce((sum, f) => sum + f.originalSize, 0);
  const totalCompressed = result.files.reduce((sum, f) => sum + f.size, 0);
  const totalPct = totalOriginal > 0 ? Math.round((1 - totalCompressed / totalOriginal) * 100) : 0;

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
        <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 17, fontWeight: 600 }}>🎉 {t("resultHeadline")}</div>
      </div>

      {result.zip && (
        <button type="button" className="hover-text" style={bigActionButton} onClick={() => (window.location.href = result.zip!.downloadUrl)}>
          {t("downloadZip")} &darr;
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
        {result.files.map((f) => {
          const pct = f.originalSize > 0 ? Math.round((1 - f.size / f.originalSize) * 100) : 0;
          return (
            <div key={f.r2Key} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 10, border: "1px solid var(--cs-line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</div>
                  <div style={{ fontSize: 11, color: "var(--cs-text-2)" }}>
                    {t("beforeAfter", { before: formatBytes(f.originalSize), after: formatBytes(f.size) })}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--cs-ok)", fontWeight: 600 }}>
                    {t("savedPct", { saved: formatBytes(f.originalSize - f.size), pct })} ✓
                  </div>
                </div>
                <a href={f.downloadUrl} style={{ flex: "none", padding: "7px 12px", borderRadius: 8, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 12, fontWeight: 500, textDecoration: "none", cursor: "pointer" }}>
                  {tc("download")}
                </a>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "var(--cs-line)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(2, 100 - pct)}%`, background: "var(--cs-accent)", borderRadius: 99 }} />
              </div>
            </div>
          );
        })}
      </div>

      {result.files.length > 1 && (
        <div style={{ fontSize: 12.5, color: "var(--cs-text-2)", textAlign: "center" }}>{t("totalSaved", { before: formatBytes(totalOriginal), after: formatBytes(totalCompressed), pct: totalPct })}</div>
      )}

      <button type="button" style={ghostButton} onClick={onReset}>
        {t("compressAgain")}
      </button>

      <div style={{ fontSize: 12, color: "var(--cs-text-2)", textAlign: "center" }}>🕐 {tp("fileDeletedIn", { time: formatCountdown(secondsLeft) })}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", fontSize: 11.5, color: "var(--cs-text-2)", paddingTop: 8, borderTop: "1px solid var(--cs-line)" }}>
        <span>🔒 {tp("trustEncrypted")}</span>
        <span>✓ {tai("trustNeverTraining")}</span>
      </div>

      {!result.loggedIn && (
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

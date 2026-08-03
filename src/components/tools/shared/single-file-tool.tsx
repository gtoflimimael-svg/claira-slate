"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";
import { FileThumbnail, type FileKind } from "@/components/tools/file-thumbnail";

type Phase = "idle" | "uploading" | "processing" | "success";

export interface SingleFileResult {
  downloadUrl: string;
  filename: string;
  size: number;
  pages: number | null;
  loggedIn: boolean;
  [key: string]: unknown;
}

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

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export interface SingleFileToolProps {
  /** Translation namespace holding this tool's own strings (button label, success headline, etc.) */
  namespace: string;
  apiPath: string;
  toolSlug: string;
  accept?: string;
  /** Builds the JSON config sent alongside the file. Called fresh on every submit. */
  buildConfig: () => Record<string, unknown>;
  /** Right-panel content above the submit button. Receives the current phase so panels can disable inputs mid-run. */
  renderConfigPanel: (ctx: { disabled: boolean; file: File }) => ReactNode;
  /** Extra lines rendered under the filename/size in the result panel (e.g. "Forms: 3 fields baked in"). */
  renderResultDetails?: (result: SingleFileResult, t: ReturnType<typeof useTranslations>) => ReactNode;
  /** Returns an error message to block submission (e.g. "check at least one option"), or null if OK. */
  validate?: () => string | null;
  submitLabelKey?: string;
  /** What kind of file this tool accepts, for the file-card thumbnail/icon. Defaults to "pdf". */
  fileKind?: FileKind;
}

export function SingleFileTool({
  namespace,
  apiPath,
  toolSlug,
  accept = ".pdf,application/pdf",
  buildConfig,
  renderConfigPanel,
  renderResultDetails,
  validate,
  submitLabelKey = "submitButton",
  fileKind = "pdf",
}: SingleFileToolProps) {
  const t = useTranslations(namespace);
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<SingleFileResult | null>(null);
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

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setPageCount(null);
    setResult(null);
    setError("");
    setPhase("idle");
  }

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setResultDeadline(null);
    setProcessingSeconds(null);
    setDownloaded(false);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!file) return;
    const validationError = validate?.();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("config", JSON.stringify(buildConfig()));

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiPath);
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
        router.push(`/login?redirect=/tools/${toolSlug}`);
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: toolSlug, plan: (json.plan as Plan) ?? "free" });
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
      setResult(json as SingleFileResult);
      setPhase("success");
      track("tool_used", { tool_name: toolSlug, user_plan: (json.plan as Plan) ?? "free", file_size: file.size, success: true });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: toolSlug });
  }

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
          <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
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
        {/* LEFT: file card */}
        <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: "clamp(18px,2.5vw,26px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
            <button type="button" style={{ ...smallButton, padding: "6px 12px", fontSize: 12.5 }} onClick={reset} disabled={phase !== "idle" && phase !== "success"}>
              {tc("chooseAnotherFile")}
            </button>
          </div>
          <div style={{ width: 220, height: 280, borderRadius: 12, overflow: "hidden", background: "var(--cs-bg-2)", border: "1px solid var(--cs-line)" }}>
            <FileThumbnail file={file} isPdf={fileKind === "pdf"} kind={fileKind} onPageCount={setPageCount} />
          </div>
          <div style={{ fontSize: 12.5, color: "var(--cs-text-2)" }}>
            {formatBytes(file.size)}
            {pageCount ? ` · ${pageCount} p.` : ""}
          </div>
        </div>

        {/* RIGHT: config / result */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {phase === "success" && result ? (
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

              <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>
                <div style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{result.filename}</div>
                <div style={{ marginTop: 3 }}>
                  {formatBytes(result.size)}
                  {result.pages ? ` · ${result.pages} p.` : ""}
                  {processingSeconds !== null && ` · ${tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}`}
                </div>
              </div>

              {renderResultDetails && <div style={{ fontSize: 13, color: "var(--cs-text)", display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>{renderResultDetails(result, t)}</div>}

              <button type="button" className="hover-text" style={bigActionButton} onClick={handleDownload}>
                {downloaded ? tc("downloaded") : tc("download")} &darr;
              </button>
              <button type="button" style={ghostButton} onClick={reset}>
                {t("processAnother")}
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
          ) : (
            <>
              {renderConfigPanel({ disabled, file })}

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
                <button type="button" style={bigActionButton} onClick={handleSubmit}>
                  {t(submitLabelKey)} &rarr;
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

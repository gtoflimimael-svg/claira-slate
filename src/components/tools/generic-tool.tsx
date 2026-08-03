"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { getAccept, type ToolConfig } from "@/lib/tools/registry";
import { track } from "@/lib/analytics";
import { formatBytes } from "@/lib/format";
import { FileCard } from "./file-card";
import { FileThumbnail } from "./file-thumbnail";

interface ToolResponse {
  downloadUrl?: string;
  filename?: string;
  r2Key?: string;
  size?: number;
  pages?: number | null;
  loggedIn?: boolean;
  comingSoon?: boolean;
  message?: string;
  error?: string;
  limit?: number;
  plan?: "free" | "pro" | "business";
}

interface StoredFile {
  id: string;
  file: File;
}

type Phase = "idle" | "uploading" | "processing" | "success";

const fieldInput: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--cs-line)",
  borderRadius: 9,
  background: "var(--cs-bg)",
  color: "var(--cs-text)",
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
};

const ghostButton: CSSProperties = {
  padding: "12px 20px",
  borderRadius: 10,
  border: "1.5px solid var(--cs-line)",
  background: "transparent",
  color: "var(--cs-text)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  width: "100%",
};

const bigActionButton: CSSProperties = {
  width: "100%",
  height: 56,
  border: "none",
  borderRadius: 12,
  background: "var(--cs-grad)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `f${Date.now()}-${Math.random()}`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function GenericTool({ config }: { config: ToolConfig }) {
  const t = useTranslations("tools");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);

  const isPdfInput = (config.inputKind ?? "pdf") === "pdf";
  const isPdfOutput = config.outputKind === "pdf";
  const accept = getAccept(config);
  const toolName = config.fallback?.name ?? t(`${config.slug}.name`);

  const [files, setFiles] = useState<StoredFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    Object.fromEntries((config.fields ?? []).map((f) => [f.name, f.defaultValue ?? ""]))
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; r2Key: string; size: number; pages: number | null; loggedIn: boolean } | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [processingSeconds, setProcessingSeconds] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = resultDeadline ? Math.max(0, Math.round((resultDeadline - now) / 1000)) : 3600;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const canReorder = config.multi && files.length > 1;

  // The R2 bucket has no CORS policy for browser fetch(), so the output file
  // can't be read directly from its presigned download URL — only navigated
  // to (which is how the download button still works). Fetch the bytes for
  // the thumbnail through our own same-origin proxy instead.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/files/preview?key=${encodeURIComponent(result.r2Key)}`);
        if (!res.ok) return;
        const blob = await res.blob();
        if (!cancelled) setPreviewFile(new File([blob], result.filename, { type: blob.type }));
      } catch {
        // Thumbnail just won't render; download still works via the direct URL.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  useEffect(() => {
    if (!resultDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resultDeadline]);

  function pickFiles(next: FileList | null) {
    if (!next || next.length === 0) return;
    const incoming = Array.from(next).map((file) => ({ id: genId(), file }));
    setFiles((prev) => (config.multi ? [...prev, ...incoming] : [incoming[0]]));
    setResult(null);
    setPreviewFile(null);
    setError("");
    setComingSoon(null);
  }

  // Ctrl/Cmd+V — lets a file copied in the OS file manager be pasted straight
  // into the drop zone, without hunting for the file picker.
  useEffect(() => {
    if (phase !== "idle") return;
    function onPaste(e: ClipboardEvent) {
      const pastedFiles = e.clipboardData?.files;
      if (pastedFiles && pastedFiles.length > 0) pickFiles(pastedFiles);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, config.multi]);

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFiles((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function handleRun() {
    if (files.length === 0) return;
    setError("");
    setComingSoon(null);
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    try {
      const formData = new FormData();
      files.forEach(({ file }) => formData.append("file", file));
      for (const [key, value] of Object.entries(fieldValues)) {
        if (value) formData.append(key, value);
      }

      const { status, json } = await new Promise<{ status: number; json: ToolResponse }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/tools/${config.slug}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
            if (pct >= 100) setPhase("processing");
          }
        };
        xhr.onload = () => {
          let parsed: ToolResponse = {};
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
        router.push(`/login?redirect=/tools/${config.slug}`);
        return;
      }
      if (status === 429) {
        setLimit(json.limit ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: config.slug, plan: json.plan ?? "free" });
        return;
      }
      if (status < 200 || status >= 300) {
        setError(json.error || tc("error"));
        setPhase("idle");
        return;
      }
      if (json.comingSoon) {
        setComingSoon(tp("comingSoonMessage"));
        setPhase("idle");
        return;
      }

      setProcessingSeconds((Date.now() - startTimeRef.current) / 1000);
      setResult({ downloadUrl: json.downloadUrl!, filename: json.filename!, r2Key: json.r2Key!, size: json.size ?? 0, pages: json.pages ?? null, loggedIn: json.loggedIn ?? false });
      setNow(Date.now());
      setResultDeadline(Date.now() + 3600_000);
      setPhase("success");
      track("tool_used", {
        tool_name: config.slug,
        user_plan: json.plan ?? "free",
        file_size: files.reduce((sum, f) => sum + f.file.size, 0),
        success: true,
      });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: config.slug });
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setPreviewFile(null);
    setResultDeadline(null);
    setProcessingSeconds(null);
    setDownloaded(false);
    setError("");
    setComingSoon(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <div className="tool-columns">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (phase === "idle") setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (phase === "idle") pickFiles(e.dataTransfer.files);
          }}
          style={{
            border: files.length === 0 ? `1.5px dashed ${dragging ? "var(--cs-accent)" : "var(--cs-accent-line)"}` : "1px solid var(--cs-line)",
            borderRadius: 20,
            background: files.length === 0 ? "var(--cs-accent-soft)" : "var(--cs-card)",
            padding: "clamp(24px,4vw,36px) 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 18,
          }}
        >
          <input ref={inputRef} type="file" accept={accept} multiple={config.multi} style={{ display: "none" }} onChange={(e) => pickFiles(e.target.files)} />

          {phase === "idle" && files.length === 0 && (
            <>
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: "-.025em" }}>
                {tp("dropFileHere")}
              </div>
              <button type="button" className="hover-text" style={bigActionButton} onClick={() => inputRef.current?.click()}>
                {tc("selectFile")}
              </button>
              <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>{tp("pasteHint")}</div>
            </>
          )}

          {(phase === "idle" || phase === "success") && files.length > 0 && (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={files.map((f) => f.id)} strategy={rectSortingStrategy}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", width: "100%" }}>
                    {files.map(({ id, file }) => (
                      <FileCard
                        key={id}
                        id={id}
                        file={file}
                        isPdf={isPdfInput}
                        draggable={phase === "idle" && canReorder}
                        onRemove={() => removeFile(id)}
                        removeLabel={tp("removeFile")}
                        dragLabel={tp("reorderFile")}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {phase === "idle" && (config.fields ?? []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", width: "100%", maxWidth: 420 }}>
                  {config.fields!.map((field) => (
                    <label key={field.name} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)", flex: "1 1 160px" }}>
                      {field.label}
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        style={fieldInput}
                        value={fieldValues[field.name] ?? ""}
                        onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
              )}

              {phase === "idle" && (
                <>
                  <button type="button" className="hover-text" style={ghostButton} onClick={() => inputRef.current?.click()}>
                    {config.multi ? `+ ${tp("addAnotherFile")}` : tc("chooseAnotherFile")}
                  </button>
                  <button type="button" style={bigActionButton} onClick={handleRun}>
                    {toolName} &rarr;
                  </button>
                </>
              )}
            </>
          )}

          {phase === "uploading" && (
            <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--cs-text-2)" }}>
                <span>{tp("uploadingFiles", { count: files.length })}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: "var(--cs-line)", overflow: "hidden" }}>
                <div className="cs-progress-fill" style={{ height: "100%", width: `${uploadProgress}%`, background: "var(--cs-grad)", borderRadius: 99 }} />
              </div>
            </div>
          )}

          {phase === "processing" && (
            <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div className="cs-spinner" />
              <div style={{ fontSize: 16, fontWeight: 600 }}>{tp("processingHeadline")}</div>
              <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>{tp("processingHint")}</div>
            </div>
          )}
        </div>

        <div
          style={{
            border: phase === "success" ? "1px solid var(--cs-line)" : "1.5px dashed var(--cs-line)",
            borderRadius: 20,
            background: phase === "success" ? "var(--cs-card)" : "transparent",
            padding: "clamp(24px,4vw,36px) 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: phase === "success" ? "flex-start" : "center",
            textAlign: "center",
            gap: 16,
            minHeight: 260,
          }}
        >
          {phase !== "success" && (
            <>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <path d="M12 3v13m0 0l-4.5-4.5M12 16l4.5-4.5" />
                <path d="M4 19h16" />
              </svg>
              <div style={{ fontSize: 13.5, color: "var(--cs-text-2)" }}>{tp("resultPlaceholder")}</div>
            </>
          )}

          {phase === "success" && result && (
            <>
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
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600 }}>{tp("successHeadline")}</div>

              {previewFile && (
                <div style={{ width: 100, height: 125, borderRadius: 10, overflow: "hidden", background: "var(--cs-bg-2)", border: "1px solid var(--cs-line)" }}>
                  <FileThumbnail file={previewFile} isPdf={isPdfOutput} />
                </div>
              )}

              <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>
                <div style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{result.filename}</div>
                <div style={{ marginTop: 3 }}>
                  {formatBytes(result.size)}
                  {result.pages ? ` · ${result.pages} p.` : ""}
                  {" · "}
                  {processingSeconds !== null && tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}
                </div>
              </div>

              <button type="button" className="hover-text" style={bigActionButton} onClick={handleDownload}>
                {downloaded ? tc("downloaded") : tc("download")} &darr;
              </button>
              <button type="button" style={ghostButton} onClick={reset}>
                {tc("chooseAnotherFile")}
              </button>
              {isPdfOutput && (
                <Link href="/ai/summarize" style={{ ...ghostButton, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {tp("summarizeWithAi")} &rarr;
                </Link>
              )}

              <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>🕐 {tp("fileDeletedIn", { time: formatCountdown(secondsLeft) })}</div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", fontSize: 11.5, color: "var(--cs-text-2)", paddingTop: 8, borderTop: "1px solid var(--cs-line)", width: "100%" }}>
                <span>🔒 {tp("trustEncrypted")}</span>
                <span>✓ {tai("trustNeverTraining")}</span>
              </div>

              {!result.loggedIn && (
                <Link
                  href="/signup"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "var(--cs-accent-soft)",
                    border: "1px solid var(--cs-accent-line)",
                    color: "var(--cs-text)",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                >
                  {tp("loginNudge")} &rarr;
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", justifyContent: "center", fontSize: 12.5, color: "var(--cs-text-2)" }}>
        <span>🔒 {tp("trustDeleted")}</span>
        <span>✓ {tp("trustNoAccount")}</span>
        <span>⚡ {tp("trustFast")}</span>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, border: "1px solid var(--cs-accent-line)", borderRadius: 16, background: "var(--cs-card)", padding: 18 }}>
          <span style={{ fontSize: 20, flex: "none" }}>⚠️</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto" }}>
            <div style={{ fontSize: 13.5, color: "var(--cs-text)" }}>{error}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="hover-text" style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }} onClick={handleRun}>
                {tc("tryAgain")}
              </button>
              <Link href="/contact" style={{ display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: "var(--cs-accent)", cursor: "pointer" }}>
                {tp("contactSupport")}
              </Link>
            </div>
          </div>
        </div>
      )}
      {comingSoon && (
        <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, fontSize: 13.5, color: "var(--cs-text-2)" }}>{comingSoon}</div>
      )}

      {limit !== null && (
        <div style={{ padding: 18, border: "1px solid var(--cs-accent-line)", borderRadius: 16, background: "var(--cs-accent-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5 }}>{tp("quotaMessage", { limit: limit ?? 5 })}</div>
          <Link href="/pricing" style={{ padding: "10px 18px", borderRadius: 9, background: "var(--cs-accent)", color: "#fff", fontSize: 14, fontWeight: 500, textDecoration: "none", display: "inline-block" }}>
            {tp("upgrade")}
          </Link>
        </div>
      )}
    </>
  );
}

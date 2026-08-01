"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";

type PageSize = "fit" | "a4-portrait" | "a4-landscape" | "letter" | "match";
type Margin = "none" | "small" | "medium" | "large";

interface StoredImage {
  id: string;
  file: File;
  dims: { w: number; h: number } | null;
}

type Phase = "idle" | "uploading" | "processing" | "success";

const MAX_IMAGES = 20;

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const cardBase: CSSProperties = { border: "1.5px solid var(--cs-line)", borderRadius: 14, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 };
const inputStyle: CSSProperties = { padding: "9px 10px", border: "1px solid var(--cs-line)", borderRadius: 8, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13.5, outline: "none", width: "100%" };
const bigActionButton: CSSProperties = { width: "100%", height: 52, border: "none", borderRadius: 12, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButton: CSSProperties = { padding: "9px 14px", borderRadius: 9, border: "1.5px solid var(--cs-accent-line)", background: "transparent", color: "var(--cs-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const smallButton: CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };

const PAGE_SIZES: PageSize[] = ["fit", "a4-portrait", "a4-landscape", "letter", "match"];
const MARGINS: Margin[] = ["none", "small", "medium", "large"];
const MARGIN_PREVIEW_PX: Record<Margin, number> = { none: 0, small: 3, medium: 7, large: 13 };

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `f${Date.now()}-${Math.random()}`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function ImageCard({ id, file, dims, draggable, onRemove, removeLabel, dragLabel }: { id: string; file: File; dims: { w: number; h: number } | null; draggable: boolean; onRemove: () => void; removeLabel: string; dragLabel: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        flex: "none",
        width: 132,
        borderRadius: 12,
        background: "var(--cs-card)",
        border: "1px solid var(--cs-line)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {draggable && (
        <button type="button" {...attributes} {...listeners} aria-label={dragLabel} style={{ position: "absolute", top: 6, left: 6, zIndex: 2, width: 22, height: 22, borderRadius: 6, border: "none", background: "rgba(255,255,255,.92)", color: "var(--cs-text-2)", cursor: "grab", display: "grid", placeItems: "center", fontSize: 13, touchAction: "none" }}>
          ⠿
        </button>
      )}
      <button type="button" onClick={onRemove} aria-label={removeLabel} style={{ position: "absolute", top: 6, right: 6, zIndex: 2, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(20,20,32,.6)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 12, lineHeight: 1 }}>
        &times;
      </button>
      <div style={{ height: 100, background: "var(--cs-bg-2)", display: "grid", placeItems: "center", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 1, borderTop: "1px solid var(--cs-line)" }}>
        <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={file.name}>
          {file.name}
        </div>
        <div style={{ fontSize: 10, color: "var(--cs-text-2)" }}>
          {dims ? `${dims.w}×${dims.h}` : formatBytes(file.size)}
        </div>
      </div>
    </div>
  );
}

export function JpgToPdfTool() {
  const t = useTranslations("jpgToPdfTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0);

  const [images, setImages] = useState<StoredImage[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>("fit");
  const [margin, setMargin] = useState<Margin>("small");
  const [imagesPerPage, setImagesPerPage] = useState<1 | 4>(1);
  const [addPageNumbers, setAddPageNumbers] = useState(false);
  const [addCaptions, setAddCaptions] = useState(false);
  const [outputName, setOutputName] = useState("combined-images");

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; r2Key: string; size: number; pages: number | null; imagesCombined: number; loggedIn: boolean } | null>(null);
  const [processingSeconds, setProcessingSeconds] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = resultDeadline ? Math.max(0, Math.round((resultDeadline - now) / 1000)) : 3600;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const disabled = phase !== "idle";

  useEffect(() => {
    if (!resultDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resultDeadline]);

  function pickFiles(next: FileList | null) {
    if (!next || next.length === 0) return;
    const incoming = Array.from(next)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ id: genId(), file, dims: null as { w: number; h: number } | null }));
    setImages((prev) => [...prev, ...incoming].slice(0, MAX_IMAGES));
    setResult(null);
    setError("");

    for (const img of incoming) {
      const url = URL.createObjectURL(img.file);
      const probe = new Image();
      probe.onload = () => {
        setImages((prev) => prev.map((p) => (p.id === img.id ? { ...p, dims: { w: probe.naturalWidth, h: probe.naturalHeight } } : p)));
        URL.revokeObjectURL(url);
      };
      probe.src = url;
    }
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setImages((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function reset() {
    setImages([]);
    setResult(null);
    setResultDeadline(null);
    setProcessingSeconds(null);
    setDownloaded(false);
    setError("");
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit() {
    if (images.length === 0) return;
    setError("");
    setPhase("uploading");
    setUploadProgress(0);
    startTimeRef.current = Date.now();

    try {
      const formData = new FormData();
      images.forEach(({ file }) => formData.append("file", file));
      formData.append("config", JSON.stringify({ pageSize, margin, imagesPerPage, addPageNumbers, addCaptions, outputName }));

      const { status, json } = await new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/tools/jpg-to-pdf");
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
        router.push("/login?redirect=/tools/jpg-to-pdf");
        return;
      }
      if (status === 429) {
        setLimit((json.limit as number) ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "jpg-to-pdf", plan: (json.plan as Plan) ?? "free" });
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
        pages: (json.pages as number) ?? null,
        imagesCombined: (json.imagesCombined as number) ?? images.length,
        loggedIn: !!json.loggedIn,
      });
      setPhase("success");
      track("tool_used", { tool_name: "jpg-to-pdf", user_plan: (json.plan as Plan) ?? "free", file_size: images.reduce((sum, f) => sum + f.file.size, 0), success: true });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: "jpg-to-pdf" });
    fetch("/api/files/consumed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ r2Key: result.r2Key }) }).catch(() => {});
  }

  return (
    <div className="split-workspace">
      <div className="split-columns">
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
            border: images.length === 0 ? `1.5px dashed ${dragging ? "var(--cs-accent)" : "var(--cs-accent-line)"}` : "1px solid var(--cs-line)",
            borderRadius: 20,
            background: images.length === 0 ? "var(--cs-accent-soft)" : "var(--cs-card)",
            padding: "clamp(18px,2.5vw,26px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            minHeight: 260,
            justifyContent: images.length === 0 ? "center" : "flex-start",
          }}
        >
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => pickFiles(e.target.files)} />

          {images.length === 0 ? (
            <>
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600, textAlign: "center" }}>{tp("dropFileHere")}</div>
              <button type="button" className="hover-text" style={bigActionButton} onClick={() => inputRef.current?.click()}>
                {tc("selectFile")}
              </button>
            </>
          ) : (
            <>
              <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t("imagesCount", { count: images.length })}</div>
                {phase === "idle" && images.length < MAX_IMAGES && (
                  <button type="button" className="hover-text" style={smallButton} onClick={() => inputRef.current?.click()}>
                    + {t("addMore")}
                  </button>
                )}
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={images.map((f) => f.id)} strategy={rectSortingStrategy}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, width: "100%" }}>
                    {images.map(({ id, file, dims }) => (
                      <ImageCard key={id} id={id} file={file} dims={dims} draggable={phase === "idle" && images.length > 1} onRemove={() => removeImage(id)} removeLabel={tp("removeFile")} dragLabel={tp("reorderFile")} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600 }}>{t("resultHeadline", { count: result.imagesCombined })}</div>
              <div style={{ fontSize: 13, color: "var(--cs-text-2)" }}>
                <div style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{result.filename}</div>
                <div style={{ marginTop: 3 }}>
                  {formatBytes(result.size)}
                  {result.pages ? ` · ${t("pagesCreated", { count: result.pages })}` : ""}
                  {processingSeconds !== null && ` · ${tp("processedIn", { time: `${processingSeconds.toFixed(1)}s` })}`}
                </div>
              </div>
              <button type="button" className="hover-text" style={bigActionButton} onClick={handleDownload}>
                {downloaded ? tc("downloaded") : tc("download")} &darr;
              </button>
              <button type="button" style={ghostButton} onClick={reset}>
                {t("processAnother")}
              </button>
              <Link href="/ai/summarize" style={{ ...ghostButton, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {tp("summarizeWithAi")} &rarr;
              </Link>
              <div style={{ fontSize: 12, color: "var(--cs-text-2)" }}>🕐 {tp("fileDeletedIn", { time: formatCountdown(secondsLeft) })}</div>
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
                <div style={sectionTitle}>{t("pageSizeHeading")}</div>
                {PAGE_SIZES.map((size) => {
                  const selected = pageSize === size;
                  return (
                    <div key={size} style={{ ...cardBase, borderColor: selected ? "var(--cs-accent)" : "var(--cs-line)", background: selected ? "var(--cs-accent-soft)" : "transparent" }} onClick={() => !disabled && setPageSize(size)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                        <span>{t(`pageSize.${size}`)}</span>
                        {selected && (
                          <span style={{ marginLeft: "auto", width: 16, height: 16, borderRadius: "50%", background: "var(--cs-ok)", display: "grid", placeItems: "center" }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 12.5l5 5L20 6.5" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={sectionTitle}>{t("marginHeading")}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {MARGINS.map((m) => {
                    const selected = margin === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={disabled}
                        onClick={() => setMargin(m)}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 4px",
                          borderRadius: 10,
                          border: `1.5px solid ${selected ? "var(--cs-accent)" : "var(--cs-line)"}`,
                          background: selected ? "var(--cs-accent-soft)" : "transparent",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <div style={{ width: 28, height: 28, border: "1px solid var(--cs-line)", background: "var(--cs-bg)", padding: MARGIN_PREVIEW_PX[m], boxSizing: "border-box" }}>
                          <div style={{ width: "100%", height: "100%", background: "var(--cs-accent-line)" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 500 }}>{t(`margin.${m}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 16, background: "var(--cs-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={sectionTitle}>{t("optionsHeading")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {([1, 4] as const).map((n) => (
                    <label key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                      <input type="radio" name="imagesPerPage" checked={imagesPerPage === n} disabled={disabled} onChange={() => setImagesPerPage(n)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                      {n === 1 ? t("onePerPageLabel") : t("fourPerPageLabel")}
                    </label>
                  ))}
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                    <input type="checkbox" checked={addPageNumbers} disabled={disabled} onChange={(e) => setAddPageNumbers(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                    {t("addPageNumbersLabel")}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                    <input type="checkbox" checked={addCaptions} disabled={disabled} onChange={(e) => setAddCaptions(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                    {t("addCaptionsLabel")}
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)" }}>{t("outputNameLabel")}</label>
                <input type="text" value={outputName} disabled={disabled} onChange={(e) => setOutputName(e.target.value)} placeholder="combined-images" style={inputStyle} />
              </div>

              {phase === "uploading" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--cs-text-2)" }}>
                    <span>{tp("uploadingFiles", { count: images.length })}</span>
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
                <button type="button" style={bigActionButton} onClick={handleSubmit} disabled={images.length === 0}>
                  {t("convertButton")} &rarr;
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

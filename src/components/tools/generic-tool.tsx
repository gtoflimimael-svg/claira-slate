"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { ToolConfig } from "@/lib/tools/registry";
import { track } from "@/lib/analytics";

interface ToolResponse {
  downloadUrl?: string;
  filename?: string;
  r2Key?: string;
  comingSoon?: boolean;
  message?: string;
  error?: string;
  limit?: number;
  plan?: "free" | "pro" | "business";
}

const primaryButton: React.CSSProperties = {
  padding: "13px 24px",
  borderRadius: 10,
  background: "var(--cs-accent)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 500,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 15px",
  borderRadius: 9,
  border: "1px solid var(--cs-line)",
  background: "transparent",
  color: "var(--cs-text)",
  fontSize: 13.5,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const fieldInput: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--cs-line)",
  borderRadius: 9,
  background: "var(--cs-bg)",
  color: "var(--cs-text)",
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
};

export function GenericTool({ config }: { config: ToolConfig }) {
  const t = useTranslations("tools");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    Object.fromEntries((config.fields ?? []).map((f) => [f.name, f.defaultValue ?? ""]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; r2Key: string } | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  function pickFiles(next: FileList | null) {
    if (!next) return;
    setFiles(config.multi ? [...files, ...Array.from(next)] : [next[0]]);
    setResult(null);
    setError("");
    setComingSoon(null);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleRun() {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    setComingSoon(null);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("file", f));
      for (const [key, value] of Object.entries(fieldValues)) {
        if (value) formData.append(key, value);
      }

      const res = await fetch(`/api/tools/${config.slug}`, { method: "POST", body: formData });
      const data: ToolResponse = await res.json();

      if (res.status === 401) {
        router.push(`/login?redirect=/tools/${config.slug}`);
        return;
      }
      if (res.status === 429) {
        setLimit(data.limit ?? 5);
        track("quota_limit_reached", { feature: config.slug, plan: data.plan ?? "free" });
        return;
      }
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      if (data.comingSoon) {
        setComingSoon(data.message ?? "This tool is coming soon.");
        return;
      }

      setResult({ downloadUrl: data.downloadUrl!, filename: data.filename!, r2Key: data.r2Key! });
      track("tool_used", {
        tool_name: config.slug,
        user_plan: data.plan ?? "free",
        file_size: files.reduce((sum, f) => sum + f.size, 0),
        success: true,
      });
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: config.slug });
    fetch("/api/files/consumed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ r2Key: result.r2Key }),
    }).catch(() => {});
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setDownloaded(false);
    setError("");
    setComingSoon(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickFiles(e.dataTransfer.files);
        }}
        style={{
          border: `1.5px dashed ${dragging ? "var(--cs-accent)" : "var(--cs-accent-line)"}`,
          borderRadius: 20,
          background: "var(--cs-accent-soft)",
          padding: "clamp(28px,4vw,44px) 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 14,
        }}
      >
        <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: "-.025em" }}>
          {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Drop a file here"}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple={config.multi}
          style={{ display: "none" }}
          onChange={(e) => pickFiles(e.target.files)}
        />
        {files.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 360 }}>
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 10px", borderRadius: 8, background: "var(--cs-card)", fontSize: 12.5 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <button type="button" onClick={() => removeFile(i)} style={{ border: "none", background: "none", color: "var(--cs-text-2)", cursor: "pointer", fontSize: 12.5 }}>
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        {(config.fields ?? []).length > 0 && files.length > 0 && (
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="hover-text" style={files.length ? secondaryButton : primaryButton} onClick={() => inputRef.current?.click()}>
            {files.length ? "Add another file" : "Select file"}
          </button>
          {files.length > 0 && !result && (
            <button type="button" style={{ ...primaryButton, opacity: loading ? 0.7 : 1 }} disabled={loading} onClick={handleRun}>
              {loading ? "Processing…" : `Run ${config.fallback?.name ?? t(`${config.slug}.name`)}`}
            </button>
          )}
        </div>
      </div>

      <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: 22, minHeight: 160 }}>
        {!result && !error && !comingSoon && (
          <div style={{ fontSize: 13.5, color: "var(--cs-text-2)", lineHeight: 1.6 }}>
            {loading ? "Working on it…" : "Upload a file to get started."}
          </div>
        )}
        {error && <div style={{ fontSize: 13.5, color: "var(--cs-bad)", lineHeight: 1.6 }}>{error}</div>}
        {comingSoon && <div style={{ fontSize: 13.5, color: "var(--cs-text-2)", lineHeight: 1.6 }}>{comingSoon}</div>}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13.5 }}>
              <strong>{result.filename}</strong> is ready.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="hover-text" style={primaryButton} onClick={handleDownload}>
                {downloaded ? "Downloaded" : "Download"}
              </button>
              <button type="button" style={secondaryButton} onClick={reset}>
                Start over
              </button>
            </div>
          </div>
        )}
      </div>

      {limit !== null && (
        <div style={{ gridColumn: "1 / -1", padding: 18, border: "1px solid var(--cs-accent-line)", borderRadius: 16, background: "var(--cs-accent-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5 }}>You&apos;ve used all {limit} free tool runs today. Upgrade to Pro for unlimited use.</div>
          <Link href="/pricing" style={{ ...primaryButton, textDecoration: "none", display: "inline-block" }}>
            Upgrade
          </Link>
        </div>
      )}
    </>
  );
}

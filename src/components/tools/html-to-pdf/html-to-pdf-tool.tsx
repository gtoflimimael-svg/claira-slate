"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { track, type Plan } from "@/lib/analytics";

type Tab = "url" | "html";
type PageSize = "a4-portrait" | "a4-landscape" | "letter-portrait" | "match-content";
type Margin = "none" | "minimal" | "standard" | "wide";
type Phase = "idle" | "processing" | "success";

const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cs-text-2)", textTransform: "uppercase", letterSpacing: ".03em" };
const cardBase: CSSProperties = { border: "1.5px solid var(--cs-line)", borderRadius: 14, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 };
const inputStyle: CSSProperties = { padding: "10px 12px", border: "1px solid var(--cs-line)", borderRadius: 9, background: "var(--cs-bg)", color: "var(--cs-text)", fontFamily: "inherit", fontSize: 13.5, outline: "none", width: "100%" };
const selectStyle: CSSProperties = { ...inputStyle, padding: "9px 10px", fontSize: 13.5 };
const bigActionButton: CSSProperties = { width: "100%", height: 52, border: "none", borderRadius: 12, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButton: CSSProperties = { padding: "9px 14px", borderRadius: 9, border: "1.5px solid var(--cs-accent-line)", background: "transparent", color: "var(--cs-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const smallButton: CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid var(--cs-line)", background: "transparent", color: "var(--cs-text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };

const PAGE_SIZES: PageSize[] = ["a4-portrait", "a4-landscape", "letter-portrait", "match-content"];
const MARGINS: Margin[] = ["none", "minimal", "standard", "wide"];

export function HtmlToPdfTool() {
  const t = useTranslations("htmlToPdfTool");
  const tp = useTranslations("toolPage");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>("a4-portrait");
  const [includeBackground, setIncludeBackground] = useState(true);
  const [waitForLoad, setWaitForLoad] = useState(true);
  const [removeHeaderFooter, setRemoveHeaderFooter] = useState(false);
  const [addUrlFooter, setAddUrlFooter] = useState(false);
  const [margin, setMargin] = useState<Margin>("standard");

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [processingSeconds, setProcessingSeconds] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; r2Key: string; size: number; pages: number | null; loggedIn: boolean } | null>(null);

  const disabled = phase !== "idle";
  const content = tab === "url" ? url.trim() : html.trim();

  async function handleSubmit() {
    if (!content) return;
    setError("");
    setPhase("processing");
    const startedAt = Date.now();

    try {
      const res = await fetch("/api/tools/html-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: tab,
          content,
          pageSize,
          includeBackground,
          waitForLoad: tab === "url" && waitForLoad,
          removeHeaderFooter,
          addUrlFooter: tab === "url" && addUrlFooter,
          margin,
        }),
      });

      if (res.status === 401) {
        router.push("/login?redirect=/tools/html-to-pdf");
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setLimit(json.limit ?? 5);
        setPhase("idle");
        track("quota_limit_reached", { feature: "html-to-pdf", plan: (json.plan as Plan) ?? "free" });
        return;
      }
      if (!res.ok) {
        setError(json.error || tc("error"));
        setPhase("idle");
        return;
      }

      setProcessingSeconds((Date.now() - startedAt) / 1000);
      setResult({ downloadUrl: json.downloadUrl, filename: json.filename, r2Key: json.r2Key, size: json.size ?? 0, pages: json.pages ?? null, loggedIn: !!json.loggedIn });
      setPhase("success");
      track("tool_used", { tool_name: "html-to-pdf", user_plan: (json.plan as Plan) ?? "free", file_size: content.length, success: true });
    } catch {
      setError(tc("couldntReachServer"));
      setPhase("idle");
    }
  }

  function handleDownload() {
    if (!result) return;
    window.location.href = result.downloadUrl;
    setDownloaded(true);
    track("file_downloaded", { tool_name: "html-to-pdf" });
    fetch("/api/files/consumed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ r2Key: result.r2Key }) }).catch(() => {});
  }

  function reset() {
    setResult(null);
    setPhase("idle");
    setError("");
    setDownloaded(false);
    setProcessingSeconds(null);
  }

  return (
    <div className="split-workspace">
      <div className="split-columns">
        <div style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: "clamp(18px,2.5vw,26px)", display: "flex", flexDirection: "column", gap: 16, minHeight: 260 }}>
          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--cs-line)", paddingBottom: 12 }}>
            {(["url", "html"] as Tab[]).map((tb) => (
              <button
                key={tb}
                type="button"
                disabled={disabled}
                onClick={() => setTab(tb)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  border: "none",
                  background: tab === tb ? "var(--cs-accent-soft)" : "transparent",
                  color: tab === tb ? "var(--cs-accent)" : "var(--cs-text-2)",
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: disabled ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t(`tab.${tb}`)}
              </button>
            ))}
          </div>

          {tab === "url" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="url" value={url} disabled={disabled} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" style={inputStyle} />
              <div style={{ border: "1px solid var(--cs-accent-line)", borderRadius: 12, background: "var(--cs-accent-soft)", padding: 12, fontSize: 12.5, color: "var(--cs-text)" }}>
                ⚠️ {t("urlWarning")}
              </div>
            </div>
          ) : (
            <textarea
              value={html}
              disabled={disabled}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="<html>...</html>"
              rows={14}
              style={{ ...inputStyle, fontFamily: "var(--font-mono, monospace)", fontSize: 12.5, resize: "vertical", minHeight: 220 }}
            />
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", justifyContent: "center", fontSize: 12.5, color: "var(--cs-text-2)", marginTop: "auto" }}>
            <span>🔒 {tp("trustDeleted")}</span>
            <span>✓ {tp("trustNoAccount")}</span>
            <span>⚡ {tp("trustFast")}</span>
          </div>
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
                <div style={sectionTitle}>{t("pageSettingsHeading")}</div>
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
                <div style={sectionTitle}>{t("optionsHeading")}</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                  <input type="checkbox" checked={includeBackground} disabled={disabled} onChange={(e) => setIncludeBackground(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                  {t("includeBackgroundLabel")}
                </label>
                {tab === "url" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                    <input type="checkbox" checked={waitForLoad} disabled={disabled} onChange={(e) => setWaitForLoad(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                    {t("waitForLoadLabel")}
                  </label>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                  <input type="checkbox" checked={removeHeaderFooter} disabled={disabled} onChange={(e) => setRemoveHeaderFooter(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                  {t("removeHeaderFooterLabel")}
                </label>
                {tab === "url" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
                    <input type="checkbox" checked={addUrlFooter} disabled={disabled} onChange={(e) => setAddUrlFooter(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--cs-accent)" }} />
                    {t("addUrlFooterLabel")}
                  </label>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)" }}>{t("marginHint")}</label>
                <select value={margin} disabled={disabled} onChange={(e) => setMargin(e.target.value as Margin)} style={selectStyle}>
                  {MARGINS.map((m) => (
                    <option key={m} value={m}>
                      {t(`margin.${m}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ border: "1px solid var(--cs-line)", borderRadius: 14, background: "var(--cs-bg-2)", padding: 14, fontSize: 12.5, color: "var(--cs-text-2)", display: "flex", gap: 8 }}>
                <span>ℹ️</span>
                <span>{t("infoBanner")}</span>
              </div>

              {phase === "processing" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", padding: "8px 0" }}>
                  <div className="cs-spinner" />
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tp("processingHeadline")}</div>
                </div>
              )}
              {phase === "idle" && (
                <button type="button" style={bigActionButton} onClick={handleSubmit} disabled={!content}>
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
    </div>
  );
}

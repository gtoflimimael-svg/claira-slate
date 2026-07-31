"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { formatBytes } from "@/lib/format";
import type { SourceFile } from "@/components/tools/organize/types";

const panelSection: CSSProperties = {
  border: "1px solid var(--cs-line)",
  borderRadius: 16,
  background: "var(--cs-card)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const sectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--cs-text-2)",
  textTransform: "uppercase",
  letterSpacing: ".03em",
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
  display: "flex",
  alignItems: "center",
  gap: 5,
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

interface RotatePanelProps {
  sources: SourceFile[];
  onAddFiles: () => void;
  onRemoveSource: (id: string) => void;
  onResetAll: () => void;
  view: "grid" | "list";
  onSetView: (v: "grid" | "list") => void;
  onRotateAll: (delta: number) => void;
  onRotatePortrait: (delta: number) => void;
  onRotateLandscape: (delta: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  totalPages: number;
  rotatedCount: number;
  onResetRotations: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  submitLabel: string;
}

export function RotatePanel({
  sources,
  onAddFiles,
  onRemoveSource,
  onResetAll,
  view,
  onSetView,
  onRotateAll,
  onRotatePortrait,
  onRotateLandscape,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  totalPages,
  rotatedCount,
  onResetRotations,
  onSubmit,
  submitDisabled,
  submitLabel,
}: RotatePanelProps) {
  const t = useTranslations("rotateTool");
  const [showShortcutsPopover, setShowShortcutsPopover] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={panelSection}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={sectionTitle}>{t("filesHeading")}</span>
          <button type="button" className="hover-text" style={{ ...smallButton, border: "none", padding: "4px 6px", color: "var(--cs-text-2)" }} onClick={onResetAll}>
            {t("resetAll")}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sources.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 8px 10px", borderRadius: 9, border: "1px solid var(--cs-line)", background: "var(--cs-bg-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flex: "none" }} />
              <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.label}: {s.file.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--cs-text-2)" }}>
                  {s.pageCount ?? "…"} p. · {formatBytes(s.file.size)}
                </div>
              </div>
              <button type="button" onClick={() => onRemoveSource(s.id)} aria-label={t("removeFile")} style={{ border: "none", background: "none", color: "var(--cs-text-2)", cursor: "pointer", fontSize: 15, flex: "none" }}>
                &times;
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="hover-text" style={{ ...smallButton, justifyContent: "center" }} onClick={onAddFiles}>
          + {t("addMoreFiles")}
        </button>
      </div>

      <div style={panelSection}>
        <span style={sectionTitle}>{t("rotateHeading")}</span>
        <div style={{ fontSize: 11.5, color: "var(--cs-text-2)" }}>{t("rotateHint")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" style={smallButton} onClick={(e) => onRotateAll(e.shiftKey ? -90 : 90)}>
            ↻ {t("rotateAll")}
          </button>
          <button type="button" style={smallButton} onClick={(e) => onRotatePortrait(e.shiftKey ? -90 : 90)}>
            ↻ {t("rotatePortrait")}
          </button>
          <button type="button" style={smallButton} onClick={(e) => onRotateLandscape(e.shiftKey ? -90 : 90)}>
            ↻ {t("rotateLandscape")}
          </button>
        </div>
      </div>

      <div style={panelSection}>
        <span style={sectionTitle}>{t("actionsHeading")}</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" style={{ ...smallButton, background: view === "grid" ? "var(--cs-accent-soft)" : "transparent", borderColor: view === "grid" ? "var(--cs-accent)" : "var(--cs-line)" }} onClick={() => onSetView("grid")}>
            ⊞ {t("gridView")}
          </button>
          <button type="button" style={{ ...smallButton, background: view === "list" ? "var(--cs-accent-soft)" : "transparent", borderColor: view === "list" ? "var(--cs-accent)" : "var(--cs-line)" }} onClick={() => onSetView("list")}>
            ☰ {t("listView")}
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" style={{ ...smallButton, opacity: canUndo ? 1 : 0.4, cursor: canUndo ? "pointer" : "not-allowed" }} onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">
            ↩ {t("undo")}
          </button>
          <button type="button" style={{ ...smallButton, opacity: canRedo ? 1 : 0.4, cursor: canRedo ? "pointer" : "not-allowed" }} onClick={onRedo} disabled={!canRedo} title="Ctrl+Shift+Z">
            ↪ {t("redo")}
          </button>
          <div style={{ position: "relative" }}>
            <button type="button" style={smallButton} onClick={() => setShowShortcutsPopover((v) => !v)} onBlur={() => setTimeout(() => setShowShortcutsPopover(false), 150)}>
              ? {t("shortcuts")}
            </button>
            {showShortcutsPopover && <ShortcutsPopover t={t} />}
          </div>
        </div>
      </div>

      <div style={panelSection}>
        <span style={sectionTitle}>{t("summaryHeading")}</span>
        <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
          <div>{t("summaryPages", { count: totalPages })}</div>
          <div>{t("summaryRotated", { count: rotatedCount })}</div>
          <div>{t("summarySources", { count: sources.length })}</div>
        </div>
        {rotatedCount > 0 && (
          <button type="button" className="hover-text" style={{ ...smallButton, border: "none", padding: 0, color: "var(--cs-accent)" }} onClick={onResetRotations}>
            {t("resetRotations")}
          </button>
        )}
      </div>

      <button type="button" style={{ ...bigActionButton, opacity: submitDisabled ? 0.5 : 1, cursor: submitDisabled ? "not-allowed" : "pointer" }} onClick={onSubmit} disabled={submitDisabled}>
        {submitLabel} &rarr;
      </button>
    </div>
  );
}

function ShortcutsPopover({ t }: { t: ReturnType<typeof useTranslations> }) {
  const rows: [string, string][] = [
    ["R", t("shortcutRotateRight")],
    ["L", t("shortcutRotateLeft")],
    ["Ctrl+A", t("shortcutSelectAll")],
    ["Esc", t("shortcutDeselect")],
    ["Ctrl+Z", t("shortcutUndo")],
    ["Ctrl+Shift+Z", t("shortcutRedo")],
  ];
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 6px)",
        zIndex: 10,
        width: 220,
        padding: 12,
        borderRadius: 12,
        border: "1px solid var(--cs-line)",
        background: "var(--cs-card)",
        boxShadow: "0 10px 30px rgba(20,20,40,.15)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {rows.map(([key, desc]) => (
        <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
          <kbd style={{ padding: "1px 6px", borderRadius: 5, border: "1px solid var(--cs-line)", background: "var(--cs-bg-2)", fontFamily: "inherit", fontSize: 11 }}>{key}</kbd>
          <span style={{ color: "var(--cs-text-2)" }}>{desc}</span>
        </div>
      ))}
    </div>
  );
}

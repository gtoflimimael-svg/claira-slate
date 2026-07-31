"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { SourceFile } from "@/components/tools/organize/types";
import type { RotatePage } from "./types";

const THUMB_RENDER_WIDTH = 320;

interface RotatePageGridProps {
  sources: SourceFile[];
  pages: RotatePage[];
  view: "grid" | "list";
  selectedIds: Set<string>;
  focusedId: string | null;
  disabled: boolean;
  onFocus: (id: string) => void;
  onSelect: (id: string, modifiers: { ctrlKey: boolean; shiftKey: boolean }) => void;
  onRotate: (id: string, delta: number) => void;
  onSourceLoaded: (sourceId: string, pageCount: number) => void;
  onPageDims: (sourceId: string, pageIndex: number, dims: { width: number; height: number }) => void;
}

export function RotatePageGrid({
  sources,
  pages,
  view,
  selectedIds,
  focusedId,
  disabled,
  onFocus,
  onSelect,
  onRotate,
  onSourceLoaded,
  onPageDims,
}: RotatePageGridProps) {
  const t = useTranslations("rotateTool");
  const pdfDocsRef = useRef<Map<string, PDFDocumentProxy>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());
  const renderingRef = useRef<Set<string>>(new Set());
  const renderedKeysRef = useRef<Set<string>>(new Set());
  const [rendered, setRendered] = useState<Map<string, string>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRegistryRef = useRef<WeakMap<Element, { sourceId: string; pageIndex: number }>>(new WeakMap());

  // Load each source's pdf.js document once. A source removed from `sources`
  // is pruned below so its memory can be freed.
  useEffect(() => {
    let cancelled = false;
    sources.forEach((src) => {
      if (pdfDocsRef.current.has(src.id) || loadingRef.current.has(src.id)) return;
      loadingRef.current.add(src.id);
      (async () => {
        try {
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
          const buffer = await src.file.arrayBuffer();
          if (cancelled) return;
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
          if (cancelled) return;
          pdfDocsRef.current.set(src.id, pdf);
          onSourceLoaded(src.id, pdf.numPages);
        } finally {
          loadingRef.current.delete(src.id);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  useEffect(() => {
    const liveIds = new Set(sources.map((s) => s.id));
    for (const id of pdfDocsRef.current.keys()) {
      if (!liveIds.has(id)) pdfDocsRef.current.delete(id);
    }
  }, [sources]);

  const renderPage = useCallback(
    async (sourceId: string, pageIndex: number) => {
      const key = `${sourceId}:${pageIndex}`;
      if (renderingRef.current.has(key) || renderedKeysRef.current.has(key)) return;
      const pdf = pdfDocsRef.current.get(sourceId);
      if (!pdf) return;
      renderingRef.current.add(key);
      try {
        const page = await pdf.getPage(pageIndex + 1);
        const baseViewport = page.getViewport({ scale: 1 });
        onPageDims(sourceId, pageIndex, { width: baseViewport.width, height: baseViewport.height });
        const scale = THUMB_RENDER_WIDTH / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvas, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        renderedKeysRef.current.add(key);
        setRendered((prev) => {
          const next = new Map(prev);
          next.set(key, dataUrl);
          return next;
        });
      } catch {
        // Skip a page that fails to render rather than breaking the grid.
      } finally {
        renderingRef.current.delete(key);
      }
    },
    [onPageDims]
  );

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const info = nodeRegistryRef.current.get(entry.target);
          if (info) renderPage(info.sourceId, info.pageIndex);
        }
      },
      { rootMargin: "800px 0px" }
    );
    return () => observerRef.current?.disconnect();
  }, [renderPage]);

  const registerNode = useCallback(
    (node: Element | null, sourceId: string, pageIndex: number) => {
      if (!node) return;
      nodeRegistryRef.current.set(node, { sourceId, pageIndex });
      observerRef.current?.observe(node);
      if (pdfDocsRef.current.has(sourceId)) renderPage(sourceId, pageIndex);
    },
    [renderPage]
  );

  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className={view === "grid" ? "organize-page-grid" : "organize-page-list"}>
      {pages.map((page, i) => {
        const source = sourceById.get(page.sourceId);
        if (!source) return null;
        const key = `${page.sourceId}:${page.originalIndex}`;
        return (
          <PageCard
            key={page.id}
            page={page}
            index={i}
            source={source}
            dataUrl={rendered.get(key)}
            view={view}
            selected={selectedIds.has(page.id)}
            focused={focusedId === page.id}
            disabled={disabled}
            registerNode={registerNode}
            onFocus={onFocus}
            onSelect={onSelect}
            onRotate={onRotate}
            t={t}
          />
        );
      })}
    </div>
  );
}

interface PageCardProps {
  page: RotatePage;
  index: number;
  source: SourceFile;
  dataUrl: string | undefined;
  view: "grid" | "list";
  selected: boolean;
  focused: boolean;
  disabled: boolean;
  registerNode: (node: Element | null, sourceId: string, pageIndex: number) => void;
  onFocus: (id: string) => void;
  onSelect: (id: string, modifiers: { ctrlKey: boolean; shiftKey: boolean }) => void;
  onRotate: (id: string, delta: number) => void;
  t: ReturnType<typeof useTranslations>;
}

function PageCard({ page, index, source, dataUrl, view, selected, focused, disabled, registerNode, onFocus, onSelect, onRotate, t }: PageCardProps) {
  const thumbRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (thumbRef.current) registerNode(thumbRef.current, page.sourceId, page.originalIndex);
  }, [registerNode, page.sourceId, page.originalIndex]);

  // Approximate an in-place 90/270 rotation preview: the thumbnail box stays
  // a fixed size, so a rotated page is scaled down to keep it fully visible
  // rather than clipped. The server-side rotation applied to the actual PDF
  // is exact — this is a display convenience only.
  const rotateStyle: CSSProperties =
    page.rotation % 180 === 0 ? { transform: `rotate(${page.rotation}deg)` } : { transform: `rotate(${page.rotation}deg) scale(0.78)` };

  return (
    <div
      className={`organize-page-card${view === "list" ? " organize-page-card--list" : ""}${selected ? " is-selected" : ""}${focused ? " is-focused" : ""}`}
      tabIndex={-1}
      aria-disabled={disabled}
      onClick={(e) => {
        if (disabled) return;
        onFocus(page.id);
        onSelect(page.id, { ctrlKey: e.ctrlKey || e.metaKey, shiftKey: e.shiftKey });
      }}
    >
      <span className="organize-page-badge-source" style={{ background: source.color }}>
        {source.label}
      </span>

      {page.rotation !== 0 && <span className="organize-page-badge-rotation">{page.rotation}°</span>}

      {selected && (
        <span className="organize-page-check">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </span>
      )}

      <div className="organize-page-actions">
        <button
          type="button"
          className="organize-page-action-btn"
          aria-label={t("rotateLeft")}
          onClick={(e) => {
            e.stopPropagation();
            onRotate(page.id, -90);
          }}
        >
          ↺
        </button>
        <button
          type="button"
          className="organize-page-action-btn"
          aria-label={t("rotateRight")}
          onClick={(e) => {
            e.stopPropagation();
            onRotate(page.id, 90);
          }}
        >
          ↻
        </button>
      </div>

      <div className="organize-page-thumb" ref={thumbRef}>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", ...rotateStyle }} />
        ) : (
          <div className="organize-page-skeleton" />
        )}
      </div>

      <div className="organize-page-label">
        {index + 1}
        {view === "list" && (
          <span className="organize-page-label-meta">
            {" · "}
            {source.label} p.{page.originalIndex + 1}
          </span>
        )}
      </div>
    </div>
  );
}

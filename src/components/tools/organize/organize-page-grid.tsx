"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OrganizePage, SourceFile } from "./types";
import { isModified } from "./types";

// Native canvas render width — higher than the CSS display size (150px) so
// the zoom-on-hover preview stays crisp without a second, more expensive
// render pass at hover time.
const THUMB_RENDER_WIDTH = 320;

interface ZoomState {
  key: string;
  x: number;
  y: number;
}

export interface OrganizePageGridHandle {
  /** Already-rendered thumbnail for a page, if available (used by the Space-bar zoom preview). */
  getThumbDataUrl: (sourceId: string, pageIndex: number) => string | undefined;
  /** Short text snippet for a page, extracted from the already-loaded pdf.js doc (used by AI Organize). */
  getPageText: (sourceId: string, pageIndex: number) => Promise<string>;
}

interface OrganizePageGridProps {
  sources: SourceFile[];
  pages: OrganizePage[];
  view: "grid" | "list";
  selectedIds: Set<string>;
  focusedId: string | null;
  disabled: boolean;
  onFocus: (id: string) => void;
  onSelect: (id: string, modifiers: { ctrlKey: boolean; shiftKey: boolean }) => void;
  onReorder: (next: OrganizePage[]) => void;
  onDelete: (id: string) => void;
  onRotate: (id: string, delta: number) => void;
  onDuplicate: (afterId: string) => void;
  onSourceLoaded: (sourceId: string, pageCount: number) => void;
}

export const OrganizePageGrid = forwardRef<OrganizePageGridHandle, OrganizePageGridProps>(function OrganizePageGrid(
  {
    sources,
    pages,
    view,
    selectedIds,
    focusedId,
    disabled,
    onFocus,
    onSelect,
    onReorder,
    onDelete,
    onRotate,
    onDuplicate,
    onSourceLoaded,
  },
  ref
) {
  const t = useTranslations("organizeTool");
  const pdfDocsRef = useRef<Map<string, PDFDocumentProxy>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());
  const renderingRef = useRef<Set<string>>(new Set());
  const renderedKeysRef = useRef<Set<string>>(new Set());
  const [rendered, setRendered] = useState<Map<string, string>>(new Map());
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRegistryRef = useRef<WeakMap<Element, { sourceId: string; pageIndex: number }>>(new WeakMap());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  // Load each source's pdf.js document once. A source removed from `sources`
  // is pruned below so its memory can be freed; new renders are cancelled by
  // never being requested again (nothing observes their nodes anymore).
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

  // Stable identity (no reactive state in its closure) so re-registering a
  // thumb node on every render doesn't thrash the IntersectionObserver.
  const renderPage = useCallback(async (sourceId: string, pageIndex: number) => {
    const key = `${sourceId}:${pageIndex}`;
    if (renderingRef.current.has(key) || renderedKeysRef.current.has(key)) return;
    const pdf = pdfDocsRef.current.get(sourceId);
    if (!pdf) return;
    renderingRef.current.add(key);
    try {
      const page = await pdf.getPage(pageIndex + 1);
      const baseViewport = page.getViewport({ scale: 1 });
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
  }, []);

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(pages, oldIndex, newIndex));
  }

  function handleZoomEnter(pageKey: string, el: HTMLElement) {
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setZoom({ key: pageKey, x: rect.left + rect.width / 2, y: rect.top });
    }, 1000);
  }

  function handleZoomLeave() {
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = null;
    setZoom(null);
  }

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const zoomDataUrl = zoom ? rendered.get(zoom.key) : null;

  useImperativeHandle(
    ref,
    () => ({
      getThumbDataUrl: (sourceId, pageIndex) => rendered.get(`${sourceId}:${pageIndex}`),
      getPageText: async (sourceId, pageIndex) => {
        const pdf = pdfDocsRef.current.get(sourceId);
        if (!pdf) return "";
        try {
          const page = await pdf.getPage(pageIndex + 1);
          const content = await page.getTextContent();
          return content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 500);
        } catch {
          return "";
        }
      },
    }),
    [rendered]
  );

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={view === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
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
                  onDelete={onDelete}
                  onRotate={onRotate}
                  onDuplicate={onDuplicate}
                  onZoomEnter={handleZoomEnter}
                  onZoomLeave={handleZoomLeave}
                  t={t}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {zoom && zoomDataUrl && (
        <div className="organize-zoom-tooltip" style={{ left: zoom.x, top: Math.max(8, zoom.y - 20) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      )}
    </>
  );
});

interface PageCardProps {
  page: OrganizePage;
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
  onDelete: (id: string) => void;
  onRotate: (id: string, delta: number) => void;
  onDuplicate: (afterId: string) => void;
  onZoomEnter: (key: string, el: HTMLElement) => void;
  onZoomLeave: () => void;
  t: ReturnType<typeof useTranslations>;
}

function PageCard({
  page,
  index,
  source,
  dataUrl,
  view,
  selected,
  focused,
  disabled,
  registerNode,
  onFocus,
  onSelect,
  onDelete,
  onRotate,
  onDuplicate,
  onZoomEnter,
  onZoomLeave,
  t,
}: PageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id, disabled });
  const cardElRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const modified = isModified(page);
  const zoomKey = `${page.sourceId}:${page.originalIndex}`;

  useEffect(() => {
    if (thumbRef.current) registerNode(thumbRef.current, page.sourceId, page.originalIndex);
  }, [registerNode, page.sourceId, page.originalIndex]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Approximate an in-place 90/270 rotation preview: the thumbnail box stays
  // a fixed size, so a rotated page is scaled down to keep it fully visible
  // rather than clipped. The server-side rotation applied to the actual PDF
  // is exact — this is a display convenience only.
  const rotateStyle: CSSProperties =
    page.rotation % 180 === 0 ? { transform: `rotate(${page.rotation}deg)` } : { transform: `rotate(${page.rotation}deg) scale(0.78)` };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        cardElRef.current = node;
      }}
      style={style}
      {...attributes}
      {...listeners}
      className={`organize-page-card${view === "list" ? " organize-page-card--list" : ""}${selected ? " is-selected" : ""}${focused ? " is-focused" : ""}`}
      tabIndex={-1}
      onClick={(e) => {
        onFocus(page.id);
        onSelect(page.id, { ctrlKey: e.ctrlKey || e.metaKey, shiftKey: e.shiftKey });
      }}
      onMouseEnter={() => cardElRef.current && onZoomEnter(zoomKey, cardElRef.current)}
      onMouseLeave={onZoomLeave}
    >
      <span className="organize-page-badge-source" style={{ background: source.color }}>
        {source.label}
      </span>

      {modified && !selected && <span className="organize-page-modified-dot" />}

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
          className="organize-page-action-btn organize-page-action-delete"
          aria-label={t("deletePage")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(page.id);
          }}
        >
          &times;
        </button>
        <button
          type="button"
          className="organize-page-action-btn organize-page-action-rotate"
          aria-label={t("rotatePage")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRotate(page.id, e.shiftKey ? -90 : 90);
          }}
        >
          ↻
        </button>
      </div>

      <button
        type="button"
        className="organize-page-duplicate-btn"
        aria-label={t("duplicatePage")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate(page.id);
        }}
      >
        📄+
      </button>

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

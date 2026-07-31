"use client";

import { useEffect, useState } from "react";

export interface PageState {
  selected: boolean;
  borderColor?: string;
  checkColor?: string;
  label?: string;
  dimmed?: boolean;
}

interface PageThumbnailGridProps {
  file: File;
  getPageState: (pageNum: number) => PageState;
  onPageClick: (pageNum: number, modifiers: { ctrlKey: boolean; shiftKey: boolean }) => void;
  onTotalPages: (n: number) => void;
  draggable?: boolean;
  onDropPageOnPage?: (draggedPage: number, targetPage: number) => void;
}

const THUMB_MAX_WIDTH = 200;

export function PageThumbnailGrid({ file, getPageState, onPageClick, onTotalPages, draggable, onDropPageOnPage }: PageThumbnailGridProps) {
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [rendered, setRendered] = useState<Map<number, string>>(new Map());
  const [dragOverPage, setDragOverPage] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const buffer = await file.arrayBuffer();
        if (cancelled) return;
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;
        setTotalPages(pdf.numPages);
        onTotalPages(pdf.numPages);

        // Render progressively — each page shows up as soon as it's ready
        // instead of waiting for the whole document.
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          try {
            const page = await pdf.getPage(i);
            const baseViewport = page.getViewport({ scale: 1 });
            const scale = THUMB_MAX_WIDTH / baseViewport.width;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            await page.render({ canvas, viewport }).promise;
            if (cancelled) return;
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            setRendered((prev) => {
              const next = new Map(prev);
              next.set(i, dataUrl);
              return next;
            });
          } catch {
            // Skip a page that fails to render rather than aborting the rest.
          }
        }
      } catch {
        if (!cancelled) setTotalPages(0);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  if (totalPages === null) {
    return (
      <div className="split-page-grid">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="split-page-skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="split-page-grid">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
        const dataUrl = rendered.get(pageNum);
        const state = getPageState(pageNum);
        return (
          <div
            key={pageNum}
            className="split-page-card"
            draggable={draggable}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(pageNum))}
            onDragOver={(e) => {
              if (!draggable) return;
              e.preventDefault();
              setDragOverPage(pageNum);
            }}
            onDragLeave={() => setDragOverPage((p) => (p === pageNum ? null : p))}
            onDrop={(e) => {
              if (!draggable) return;
              e.preventDefault();
              setDragOverPage(null);
              const dragged = Number(e.dataTransfer.getData("text/plain"));
              if (dragged && dragged !== pageNum) onDropPageOnPage?.(dragged, pageNum);
            }}
            style={{
              borderColor: dragOverPage === pageNum ? "var(--cs-accent)" : state.borderColor ?? "var(--cs-line)",
              opacity: state.dimmed ? 0.45 : 1,
            }}
            onClick={(e) => onPageClick(pageNum, { ctrlKey: e.ctrlKey || e.metaKey, shiftKey: e.shiftKey })}
          >
            {state.selected && (
              <div className="split-page-check" style={{ background: state.checkColor ?? "var(--cs-accent)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </div>
            )}
            <div className="split-page-thumb">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div className="split-page-skeleton" style={{ position: "static", width: "100%", height: "100%" }} />
              )}
            </div>
            <div className="split-page-label">
              {state.label ?? pageNum}
            </div>
          </div>
        );
      })}
    </div>
  );
}

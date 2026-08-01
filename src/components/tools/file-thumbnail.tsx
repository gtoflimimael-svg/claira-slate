"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type FileKind = "pdf" | "image" | "word" | "excel" | "ppt" | "generic";

interface FileThumbnailProps {
  file: File;
  isPdf: boolean;
  onPageCount?: (count: number) => void;
  /** Overrides the icon shown for non-PDF, non-image files (Word/Excel/PPT get a branded colored icon instead of the generic outline). */
  kind?: FileKind;
}

const genericIcon = (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const docBadge = (color: string, label: string) => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill={color} opacity="0.14" />
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 2v6h6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <text x="12" y="17.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fontFamily="Arial, sans-serif" fill={color}>
      {label}
    </text>
  </svg>
);

const wordIcon = docBadge("#2b579a", "W");
const excelIcon = docBadge("#217346", "X");
const pptIcon = docBadge("#d24726", "P");

function iconForKind(kind: FileKind | undefined) {
  if (kind === "word") return wordIcon;
  if (kind === "excel") return excelIcon;
  if (kind === "ppt") return pptIcon;
  return genericIcon;
}

export function FileThumbnail({ file, isPdf, onPageCount, kind }: FileThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);

  const imageUrl = useMemo(() => {
    if (!isPdf && file.type.startsWith("image/")) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file, isPdf]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    let cancelled = false;

    if (isPdf) {
      (async () => {
        try {
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
          const buffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
          if (cancelled) return;
          onPageCount?.(pdf.numPages);
          const page = await pdf.getPage(1);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = 220 / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const canvas = canvasRef.current;
          if (!canvas || cancelled) return;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
          if (!cancelled) setRendered(true);
        } catch {
          if (!cancelled) setFailed(true);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [file, isPdf, onPageCount]);

  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }

  if (isPdf && !failed) {
    return (
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", objectFit: "contain", opacity: rendered ? 1 : 0, transition: "opacity .2s ease" }}
      />
    );
  }

  return <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%" }}>{iconForKind(kind)}</div>;
}

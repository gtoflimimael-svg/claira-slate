"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface FileThumbnailProps {
  file: File;
  isPdf: boolean;
  onPageCount?: (count: number) => void;
}

const genericIcon = (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

export function FileThumbnail({ file, isPdf, onPageCount }: FileThumbnailProps) {
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

  return <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%" }}>{genericIcon}</div>;
}

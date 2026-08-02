"use client";

// Shared client-side pdfjs bootstrap, used by any tool that needs to render
// PDF pages onto a canvas (sign, redact) beyond the single-thumbnail case
// FileThumbnail already covers.
export async function loadPdfDocument(file: File) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const buffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: buffer }).promise;
}

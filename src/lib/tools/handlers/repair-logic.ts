import { PDFDocument } from "pdf-lib";
import { rasterizePdfPages, buildPdfFromImages, recompressJpeg } from "@/lib/tools/raster";

export interface RepairResult {
  buffer: Buffer;
  pagesRecovered: number;
  pagesTotal: number;
  fullyRecovered: boolean;
}

// Best-effort raw scan for a page-count hint when the file is too damaged to
// parse at all — counts `/Type /Page` object markers in the raw bytes (a
// common, if imprecise, PDF-recovery diagnostic technique).
function estimatePageCount(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

// Never throws — always returns *something* to hand back to the user, with
// an honest recovered/total count, per spec ("never return an error page").
export async function runRepair(buffer: Buffer): Promise<RepairResult> {
  // Attempt 1: pdf-lib is already fairly tolerant (ignoreEncryption,
  // throwOnInvalidObject: false) — re-saving rebuilds the cross-reference
  // table and object streams from scratch, which alone repairs many
  // "broken xref" / "truncated file" / "broken object stream" cases.
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
    const total = doc.getPageCount();
    const repaired = Buffer.from(await doc.save({ useObjectStreams: false }));
    return { buffer: repaired, pagesRecovered: total, pagesTotal: total, fullyRecovered: true };
  } catch {
    // Fall through to raster recovery.
  }

  // Attempt 2: pdf.js (via pdf-parse, used by rasterizePdfPages) tolerates
  // more structural damage than pdf-lib's writer — if it can rasterize at
  // least some pages, rebuild a fresh PDF from those images. This preserves
  // visual content even when the original object graph is unrecoverable.
  const estimatedTotal = estimatePageCount(buffer);
  try {
    const pages = await rasterizePdfPages(buffer);
    if (pages.length > 0) {
      const jpegPages = await Promise.all(
        pages.map(async (p) => ({ width: p.width, height: p.height, jpeg: await recompressJpeg(p.png, 85, false) }))
      );
      const rebuilt = Buffer.from(await buildPdfFromImages(jpegPages));
      const total = Math.max(estimatedTotal, pages.length);
      return { buffer: rebuilt, pagesRecovered: pages.length, pagesTotal: total, fullyRecovered: pages.length >= total };
    }
  } catch {
    // Fall through to the last resort.
  }

  // Last resort: hand back the original bytes unchanged rather than an
  // error — the user keeps their file, with an honest "0 recovered" report.
  return { buffer, pagesRecovered: 0, pagesTotal: estimatedTotal, fullyRecovered: false };
}

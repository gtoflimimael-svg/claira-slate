import { PDFDocument } from "pdf-lib";
import { loadPdfDoc } from "@/lib/tools/stamp";
import { rasterizePdfPages, recompressJpeg, buildPdfFromImages } from "@/lib/tools/raster";

export interface SplitRangeSpec {
  from: number; // 1-indexed, inclusive
  to: number; // 1-indexed, inclusive
  name?: string;
}

export type SplitMode = "range" | "pages" | "size" | "smart";

export interface SplitConfig {
  mode: SplitMode;
  // range mode
  ranges?: SplitRangeSpec[];
  mergeRanges?: boolean;
  // pages mode
  selectedPages?: number[]; // 1-indexed
  mergePages?: boolean;
  // size mode
  maxSizeKB?: number;
  // common
  compress?: boolean;
  fileNames?: string[];
}

export interface SplitFileResult {
  buffer: Buffer;
  filename: string;
  pages: number;
}

const KB = 1024;

async function copyPagesToNewDoc(source: PDFDocument, pageIndices: number[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(source, pageIndices);
  pages.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save());
}

async function compressPdfBuffer(buffer: Buffer): Promise<Buffer> {
  const pages = await rasterizePdfPages(buffer);
  const jpegPages = await Promise.all(
    pages.map(async (p) => ({
      width: p.width,
      height: p.height,
      jpeg: await recompressJpeg(p.png, 55, false),
    }))
  );
  return Buffer.from(await buildPdfFromImages(jpegPages));
}

function defaultName(baseName: string, index: number, total: number): string {
  return total === 1 ? `${baseName}.pdf` : `${baseName}-part-${index + 1}.pdf`;
}

function resolveNames(baseName: string, count: number, fileNames?: string[]): string[] {
  if (fileNames && fileNames.length === count && fileNames.every((n) => n.trim())) {
    return fileNames.map((n) => (n.toLowerCase().endsWith(".pdf") ? n : `${n}.pdf`));
  }
  return Array.from({ length: count }, (_, i) => defaultName(baseName, i, count));
}

/** Measures each page's own single-page-PDF byte size — used to greedily pack pages into size-capped files without repeatedly re-saving a growing cumulative PDF. */
async function measurePageSizes(doc: PDFDocument): Promise<number[]> {
  const total = doc.getPageCount();
  const sizes: number[] = [];
  for (let i = 0; i < total; i++) {
    const buf = await copyPagesToNewDoc(doc, [i]);
    sizes.push(buf.byteLength);
  }
  return sizes;
}

export async function runSplit(fileBuffer: Buffer, baseName: string, config: SplitConfig): Promise<SplitFileResult[]> {
  const doc = await loadPdfDoc(fileBuffer);
  const total = doc.getPageCount();

  let chunks: { indices: number[] }[] = [];

  if (config.mode === "range") {
    // Clamp both bounds into [1, total] before validating — an out-of-range
    // `to` (e.g. a stray large number) should collapse to the nearest valid
    // page, not silently produce a 0-page output once `to` alone was clamped
    // but `from` still exceeded it.
    const ranges = (config.ranges ?? [])
      .map((r) => ({ from: Math.max(1, Math.min(r.from, total)), to: Math.max(1, Math.min(r.to, total)) }))
      .filter((r) => r.to >= r.from);
    if (ranges.length === 0) throw new Error("No page ranges specified.");
    if (config.mergeRanges) {
      const indices: number[] = [];
      for (const r of ranges) {
        for (let p = r.from; p <= r.to; p++) indices.push(p - 1);
      }
      chunks = [{ indices }];
    } else {
      chunks = ranges.map((r) => ({
        indices: Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from - 1 + i),
      }));
    }
  } else if (config.mode === "pages") {
    const selected = [...new Set((config.selectedPages ?? []).filter((p) => p >= 1 && p <= total))].sort((a, b) => a - b);
    if (selected.length === 0) throw new Error("No pages selected.");
    if (config.mergePages) {
      chunks = [{ indices: selected.map((p) => p - 1) }];
    } else {
      chunks = selected.map((p) => ({ indices: [p - 1] }));
    }
  } else if (config.mode === "size") {
    const maxBytes = Math.max(1, config.maxSizeKB ?? 500) * KB;
    const sizes = await measurePageSizes(doc);
    let current: number[] = [];
    let currentSize = 0;
    const overheadPerFile = 800; // rough PDF container overhead beyond summed page bytes
    for (let i = 0; i < total; i++) {
      const pageSize = sizes[i];
      if (current.length > 0 && currentSize + pageSize + overheadPerFile > maxBytes) {
        chunks.push({ indices: current });
        current = [];
        currentSize = 0;
      }
      current.push(i);
      currentSize += pageSize;
    }
    if (current.length > 0) chunks.push({ indices: current });
  } else {
    throw new Error(`Unsupported split mode "${config.mode}".`);
  }

  const names = resolveNames(baseName, chunks.length, config.fileNames);

  const results: SplitFileResult[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let buffer = await copyPagesToNewDoc(doc, chunks[i].indices);
    if (config.compress) {
      try {
        buffer = await compressPdfBuffer(buffer);
      } catch {
        // Fall back to the uncompressed chunk rather than failing the whole split.
      }
    }
    results.push({ buffer, filename: names[i], pages: chunks[i].indices.length });
  }

  return results;
}

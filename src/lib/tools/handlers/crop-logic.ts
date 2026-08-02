import { PDFDocument } from "pdf-lib";

export type CropUnit = "mm" | "px" | "inches";
export type CropMethod = "manual" | "preset" | "auto";
export type CropPreset = "a4-portrait" | "a4-landscape" | "letter" | "square" | "custom";

export interface CropMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
  unit: CropUnit;
}

export interface CropConfig {
  method: CropMethod;
  margins?: CropMargins;
  preset?: CropPreset;
  customSize?: { width: number; height: number; unit: CropUnit };
  applyTo: "all" | number[];
  maintainAspectRatio?: boolean;
}

export interface CropPageResult {
  page: number;
  originalWidthPt: number;
  originalHeightPt: number;
  newWidthPt: number;
  newHeightPt: number;
  marginsPt: { top: number; bottom: number; left: number; right: number };
}

export interface CropResult {
  buffer: Buffer;
  pagesCropped: number;
  perPage: CropPageResult[];
}

const MM_PER_PT = 1 / 2.83464567;
const PT_PER_MM = 2.83464567;
const PT_PER_INCH = 72;

export function toPoints(value: number, unit: CropUnit): number {
  if (unit === "mm") return value * PT_PER_MM;
  if (unit === "inches") return value * PT_PER_INCH;
  return value; // px treated 1:1 with points, consistent with how this tool's UI presents sizes
}

export function fromPoints(value: number, unit: CropUnit): number {
  if (unit === "mm") return value * MM_PER_PT;
  if (unit === "inches") return value / PT_PER_INCH;
  return value;
}

const PRESET_SIZE_MM: Record<Exclude<CropPreset, "custom" | "square">, { w: number; h: number }> = {
  "a4-portrait": { w: 210, h: 297 },
  "a4-landscape": { w: 297, h: 210 },
  letter: { w: 215.9, h: 279.4 },
};

function presetSizePt(config: CropConfig): { w: number; h: number } | null {
  if (config.preset === "custom" && config.customSize) {
    return { w: toPoints(config.customSize.width, config.customSize.unit), h: toPoints(config.customSize.height, config.customSize.unit) };
  }
  if (config.preset && config.preset !== "custom" && config.preset !== "square") {
    const mm = PRESET_SIZE_MM[config.preset];
    return { w: mm.w * PT_PER_MM, h: mm.h * PT_PER_MM };
  }
  return null; // "square" is resolved per-page, since it depends on that page's own dimensions
}

function resolveTargetPages(applyTo: CropConfig["applyTo"], pageCount: number): number[] {
  if (applyTo === "all") return Array.from({ length: pageCount }, (_, i) => i + 1);
  return applyTo.filter((p) => p >= 1 && p <= pageCount);
}

/** Rasterizes a page and finds the bounding box of non-white content, in PDF points from each edge. */
async function detectContentMargins(doc: import("mupdf").PDFDocument, pageIndex: number): Promise<{ top: number; bottom: number; left: number; right: number } | null> {
  const mupdf = await import("mupdf");
  const page = doc.loadPage(pageIndex);
  const bounds = page.getBounds();
  const pageW = bounds[2] - bounds[0];
  const pageH = bounds[3] - bounds[1];

  const RENDER_DPI = 100;
  const scale = RENDER_DPI / 72;
  const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false);
  const w = pixmap.getWidth();
  const h = pixmap.getHeight();
  const n = pixmap.getNumberOfComponents();
  const pixels = pixmap.getPixels();

  const THRESHOLD = 250;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    const rowStart = y * w * n;
    for (let x = 0; x < w; x++) {
      const idx = rowStart + x * n;
      if (pixels[idx] < THRESHOLD || pixels[idx + 1] < THRESHOLD || pixels[idx + 2] < THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // blank page — nothing to crop to

  const pad = 4; // small safety padding in points so glyph anti-aliasing isn't clipped
  return {
    left: Math.max(0, minX / scale - pad),
    right: Math.max(0, pageW - maxX / scale - pad),
    top: Math.max(0, minY / scale - pad),
    bottom: Math.max(0, pageH - maxY / scale - pad),
  };
}

export async function runCrop(fileBuffer: Buffer, config: CropConfig): Promise<CropResult> {
  const doc = await PDFDocument.load(fileBuffer);
  const pages = doc.getPages();
  const targetPages = resolveTargetPages(config.applyTo, pages.length);
  const perPage: CropPageResult[] = [];

  let mupdfDoc: import("mupdf").PDFDocument | null = null;
  if (config.method === "auto") {
    const mupdf = await import("mupdf");
    const opened = mupdf.Document.openDocument(fileBuffer, "application/pdf");
    mupdfDoc = opened.asPDF();
  }

  const fixedTargetSize = config.method === "preset" ? presetSizePt(config) : null;

  for (const pageNum of targetPages) {
    const page = pages[pageNum - 1];
    const { width, height } = page.getSize();
    let top = 0;
    let bottom = 0;
    let left = 0;
    let right = 0;

    if (config.method === "manual" && config.margins) {
      top = toPoints(config.margins.top, config.margins.unit);
      bottom = toPoints(config.margins.bottom, config.margins.unit);
      left = toPoints(config.margins.left, config.margins.unit);
      right = toPoints(config.margins.right, config.margins.unit);
    } else if (config.method === "preset") {
      const target = config.preset === "square" ? { w: Math.min(width, height), h: Math.min(width, height) } : fixedTargetSize ?? { w: width, h: height };
      const clampedW = Math.min(target.w, width);
      const clampedH = Math.min(target.h, height);
      left = (width - clampedW) / 2;
      right = width - clampedW - left;
      top = (height - clampedH) / 2;
      bottom = height - clampedH - top;
    } else if (config.method === "auto" && mupdfDoc) {
      const detected = await detectContentMargins(mupdfDoc, pageNum - 1);
      if (detected) ({ top, bottom, left, right } = detected);
    }

    if (config.maintainAspectRatio) {
      const targetW = Math.max(1, width - left - right);
      const targetH = Math.max(1, height - top - bottom);
      const originalRatio = width / height;
      const currentRatio = targetW / targetH;
      if (currentRatio > originalRatio) {
        // too wide — trim extra width symmetrically
        const wantedW = targetH * originalRatio;
        const extra = (targetW - wantedW) / 2;
        left += extra;
        right += extra;
      } else if (currentRatio < originalRatio) {
        // too tall — trim extra height symmetrically
        const wantedH = targetW / originalRatio;
        const extra = (targetH - wantedH) / 2;
        top += extra;
        bottom += extra;
      }
    }

    top = Math.max(0, Math.min(top, height - 1));
    bottom = Math.max(0, Math.min(bottom, height - 1 - top));
    left = Math.max(0, Math.min(left, width - 1));
    right = Math.max(0, Math.min(right, width - 1 - left));

    const newWidth = width - left - right;
    const newHeight = height - top - bottom;
    page.setCropBox(left, bottom, newWidth, newHeight);

    perPage.push({
      page: pageNum,
      originalWidthPt: width,
      originalHeightPt: height,
      newWidthPt: newWidth,
      newHeightPt: newHeight,
      marginsPt: { top, bottom, left, right },
    });
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer, pagesCropped: targetPages.length, perPage };
}

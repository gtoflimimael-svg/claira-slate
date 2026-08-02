import { PDFParse } from "pdf-parse";
import { createWorker, detect } from "tesseract.js";
import { PDFDocument, rgb } from "pdf-lib";

export type OcrQuality = "fast" | "balanced" | "precise";
export type OcrOutputMode = "searchable" | "text-visible";

export interface OcrConfig {
  languages: string[]; // tesseract language codes, e.g. ["eng","fra"]; [] means auto-detect
  quality: OcrQuality;
  outputMode: OcrOutputMode;
  correctSkew: boolean;
  removeNoise: boolean;
  detectTables: boolean;
  generateTextFile: boolean;
}

export interface OcrLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  confidence: number;
}

export interface OcrPageResult {
  pageNumber: number;
  width: number;
  height: number;
  image: Uint8Array;
  lines: OcrLine[];
  text: string;
  confidence: number;
}

export interface OcrRunResult {
  pages: OcrPageResult[];
  fullText: string;
  languagesUsed: string[];
  averageConfidence: number;
}

// Higher render DPI trades speed for OCR accuracy — "precise" is the
// Pro-gated tier, enforced by the API route rather than this function.
const QUALITY_SCALE: Record<OcrQuality, number> = { fast: 1.4, balanced: 2, precise: 3 };

// Best-effort script -> language mapping for "auto-detect": run Tesseract's
// OSD (orientation/script detection, no language-specific data needed) on
// the first page, then pick a representative trained language for that
// script. Approximate by nature — real per-word language identification
// would need every candidate language pack loaded and compared.
const SCRIPT_TO_LANG: Record<string, string> = {
  Latin: "eng",
  Han: "chi_sim",
  Hiragana: "jpn",
  Katakana: "jpn",
  Korean: "kor",
  Hangul: "kor",
  Arabic: "ara",
  Devanagari: "hin",
  Cyrillic: "rus",
};

export async function runAdvancedOcr(
  buffer: Buffer,
  config: OcrConfig,
  onProgress?: (page: number, total: number) => void
): Promise<OcrRunResult> {
  const scale = QUALITY_SCALE[config.quality];
  const parser = new PDFParse({ data: buffer });
  let screenshots;
  try {
    screenshots = await parser.getScreenshot({ scale, imageBuffer: true, imageDataUrl: false });
  } finally {
    await parser.destroy();
  }

  let languages = config.languages.filter(Boolean).slice(0, 3);
  if (languages.length === 0) {
    languages = ["eng"];
    try {
      const first = screenshots.pages[0];
      if (first) {
        const detected = await detect(Buffer.from(first.data));
        const script = detected?.data?.script as string | undefined;
        if (script && SCRIPT_TO_LANG[script]) languages = [SCRIPT_TO_LANG[script]];
      }
    } catch {
      // Fall back to English if OSD script detection fails for any reason.
    }
  }

  const worker = await createWorker(languages);
  if (config.detectTables) {
    // Keeps column gaps intact in the extracted text — the real, standard
    // Tesseract technique for preserving simple table/column structure in
    // plain-text output (there's no vector grid to detect on a scanned page).
    await worker.setParameters({ preserve_interword_spaces: "1" });
  }

  const pages: OcrPageResult[] = [];
  let confSum = 0;
  let confCount = 0;

  try {
    for (const shot of screenshots.pages) {
      let imageBuffer = Buffer.from(shot.data);
      if (config.removeNoise) {
        try {
          const sharp = (await import("sharp")).default;
          imageBuffer = await sharp(imageBuffer).median(3).normalize().png().toBuffer();
        } catch {
          // Keep the original raster if the denoise pass fails for any reason.
        }
      }

      const result = await worker.recognize(imageBuffer, { rotateAuto: config.correctSkew }, { text: true, blocks: true });

      const lines: OcrLine[] = [];
      for (const block of result.data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            if (!line.text.trim()) continue;
            const heightPx = line.bbox.y1 - line.bbox.y0;
            lines.push({
              text: line.text.trim(),
              x: line.bbox.x0 / scale,
              // Image coordinates are top-down; PDF coordinates are bottom-up.
              y: (shot.height - line.bbox.y1) / scale,
              fontSize: Math.max(6, heightPx / scale),
              confidence: line.confidence,
            });
            confSum += line.confidence;
            confCount++;
          }
        }
      }

      pages.push({
        pageNumber: shot.pageNumber,
        width: shot.width / scale,
        height: shot.height / scale,
        image: shot.data,
        lines,
        text: result.data.text,
        confidence: result.data.confidence,
      });
      onProgress?.(shot.pageNumber, screenshots.total);
    }
  } finally {
    await worker.terminate();
  }

  return {
    pages,
    fullText: pages.map((p) => p.text).join("\n\n"),
    languagesUsed: languages,
    averageConfidence: confCount > 0 ? confSum / confCount : 0,
  };
}

// Original page rasterized as the visual background, OCR'd lines drawn on
// top at ~0 opacity — invisible but present as real text content, so the
// PDF becomes selectable/searchable without changing how the page looks.
export async function buildSearchablePdf(pages: OcrPageResult[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const ocrPage of pages) {
    const page = doc.addPage([ocrPage.width, ocrPage.height]);
    const image = await doc.embedPng(ocrPage.image);
    page.drawImage(image, { x: 0, y: 0, width: ocrPage.width, height: ocrPage.height });
    for (const line of ocrPage.lines) {
      try {
        page.drawText(line.text, { x: line.x, y: line.y, size: line.fontSize, color: rgb(0, 0, 0), opacity: 0 });
      } catch {
        // Skip lines containing characters the base font can't encode.
      }
    }
  }
  return doc.save();
}

// Blank page per OCR'd page, with the recognized text drawn as normal
// visible black text at its detected position — no scanned image
// underneath, so the output is cleaner but may not visually match the
// original page.
export async function buildTextVisiblePdf(pages: OcrPageResult[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const ocrPage of pages) {
    const page = doc.addPage([ocrPage.width, ocrPage.height]);
    for (const line of ocrPage.lines) {
      try {
        page.drawText(line.text, { x: line.x, y: line.y, size: line.fontSize, color: rgb(0, 0, 0) });
      } catch {
        // Skip lines containing characters the base font can't encode.
      }
    }
  }
  return doc.save();
}

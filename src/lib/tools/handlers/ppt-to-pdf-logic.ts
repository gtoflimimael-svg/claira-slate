import JSZip from "jszip";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { convertWithLibreOffice, checkSofficeAvailable, type LibreOfficeFilterValue } from "@/lib/tools/libreoffice";

export type PptToPdfLayout = "single" | "handout-2" | "handout-4" | "handout-6" | "notes";
export type PptToPdfQuality = "standard" | "high";

export interface PptToPdfConfig {
  layout: PptToPdfLayout;
  includeHidden: boolean;
  addSlideNumbers: boolean;
  includeSpeakerNotesFooter: boolean;
  quality: PptToPdfQuality;
}

export interface PptToPdfResult {
  buffer: Buffer;
  slideCount: number;
  pagesCreated: number;
}

const QUALITY_FILTER: Record<PptToPdfQuality, Record<string, LibreOfficeFilterValue>> = {
  standard: {
    Quality: { type: "long", value: "70" },
    ReduceImageResolution: { type: "boolean", value: "true" },
    MaxImageResolution: { type: "long", value: "200" },
  },
  high: { Quality: { type: "long", value: "97" }, ReduceImageResolution: { type: "boolean", value: "false" } },
};
const JPEG_QUALITY: Record<PptToPdfQuality, number> = { standard: 70, high: 92 };

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of xml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    const type = attr(m[0], "Type");
    if (id && target) map.set(id, target);
    void type;
  }
  return map;
}

/** Order of (slide path, hidden) tuples exactly matching presentation display order. */
async function getSlideOrder(zip: JSZip): Promise<{ path: string; hidden: boolean }[]> {
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");
  const presentationRels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("text");
  if (!presentationXml || !presentationRels) return [];

  const relMap = parseRelationships(presentationRels);
  const rIds = [...presentationXml.matchAll(/<p:sldId\b[^>]*\/?>/g)]
    .map((m) => attr(m[0], "r:id"))
    .filter((id): id is string => !!id);

  const result: { path: string; hidden: boolean }[] = [];
  for (const rId of rIds) {
    const target = relMap.get(rId);
    if (!target) continue;
    const path = `ppt/${target.replace(/^\.?\//, "")}`;
    const slideXml = await zip.file(path)?.async("text");
    if (!slideXml) continue;
    const sldTag = slideXml.match(/<p:sld\b[^>]*>/);
    const hidden = sldTag ? attr(sldTag[0], "show") === "0" : false;
    result.push({ path, hidden });
  }
  return result;
}

async function getNotesText(zip: JSZip, slidePath: string): Promise<string> {
  const slideFile = slidePath.split("/").pop()!;
  const relsPath = `ppt/slides/_rels/${slideFile}.rels`;
  const relsXml = await zip.file(relsPath)?.async("text");
  if (!relsXml) return "";

  const relMap = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const type = attr(m[0], "Type") ?? "";
    const target = attr(m[0], "Target");
    if (target && type.endsWith("/notesSlide")) relMap.set("notes", target);
  }
  const notesTarget = relMap.get("notes");
  if (!notesTarget) return "";

  const notesPath = `ppt/slides/${notesTarget}`.replace(/\/slides\/\.\.\//, "/");
  const notesXml = await zip.file(notesPath)?.async("text");
  if (!notesXml) return "";

  // The notes slide has several placeholder shapes (slide-image, slide
  // number, date, footer) besides the actual notes body — grabbing every
  // <a:t> in the file also picks up the slide-number field's cached text.
  // Only the shape *without* one of those non-body placeholder types holds
  // the real notes.
  const NON_BODY_PH = /<p:ph\b[^>]*type="(sldImg|sldNum|dt|ftr|hdr)"/;
  const texts: string[] = [];
  for (const shape of notesXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    if (NON_BODY_PH.test(shape[0])) continue;
    for (const m of shape[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)) texts.push(decodeXmlText(m[1]));
  }
  return texts.join(" ").trim();
}

function extOf(filename: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "pptx";
}

const HANDOUT_GRID: Record<"handout-2" | "handout-4" | "handout-6", { cols: number; rows: number }> = {
  "handout-2": { cols: 1, rows: 2 },
  "handout-4": { cols: 2, rows: 2 },
  "handout-6": { cols: 2, rows: 3 },
};

const PAGE_W = 612; // US Letter, portrait — standard handout/notes print size
const PAGE_H = 792;

function resolveRelPath(baseDir: string, target: string): string {
  const baseParts = baseDir.split("/").filter(Boolean);
  for (const part of target.split("/")) {
    if (part === "..") baseParts.pop();
    else if (part !== "." && part !== "") baseParts.push(part);
  }
  return baseParts.join("/");
}

async function getSlideSizePt(zip: JSZip): Promise<[number, number]> {
  const xml = await zip.file("ppt/presentation.xml")?.async("text");
  const m = xml?.match(/<p:sldSz\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  if (!m) return [720, 405];
  return [Number(m[1]) / 12700, Number(m[2]) / 12700];
}

/** Every text run on the slide, in document order — one entry per paragraph. */
async function extractSlideTextLines(zip: JSZip, slidePath: string): Promise<string[]> {
  const xml = await zip.file(slidePath)?.async("text");
  if (!xml) return [];
  const lines: string[] = [];
  for (const shape of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    for (const para of shape[0].matchAll(/<a:p>[\s\S]*?<\/a:p>/g)) {
      const text = [...para[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXmlText(m[1])).join("");
      if (text.trim()) lines.push(text.trim());
    }
  }
  return lines;
}

async function extractSlideImages(zip: JSZip, slidePath: string): Promise<Buffer[]> {
  const slideFile = slidePath.split("/").pop()!;
  const relsXml = await zip.file(`ppt/slides/_rels/${slideFile}.rels`)?.async("text");
  if (!relsXml) return [];

  const images: Buffer[] = [];
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const type = attr(m[0], "Type") ?? "";
    const target = attr(m[0], "Target");
    if (!target || !type.endsWith("/image")) continue;
    const path = resolveRelPath("ppt/slides", target);
    const data = await zip.file(path)?.async("nodebuffer");
    if (data) images.push(data);
  }
  return images;
}

function isLikelyHeading(line: string): boolean {
  return line.length > 0 && line.length <= 70 && !/[.,;:]$/.test(line);
}

// Runs when LibreOffice isn't installed: parses each slide's own XML for
// text and embedded images (pptxgenjs only *writes* pptx files, it can't
// read an existing one back) and renders a plain "one slide per page" PDF —
// no animations/transitions/precise layout, just the content.
async function renderSlideToPage(doc: PDFDocument, font: PDFFont, boldFont: PDFFont, zip: JSZip, slidePath: string, pageW: number, pageH: number, quality: PptToPdfQuality): Promise<void> {
  const page = doc.addPage([pageW, pageH]);
  const lines = await extractSlideTextLines(zip, slidePath);
  const images = await extractSlideImages(zip, slidePath);

  let title = "";
  let bodyLines = lines;
  if (lines.length > 0 && isLikelyHeading(lines[0])) {
    title = lines[0];
    bodyLines = lines.slice(1);
  }

  const margin = Math.max(30, pageW * 0.06);
  let cursorY = pageH - margin - 10;

  if (title) {
    const size = Math.min(28, pageW / 20);
    page.drawText(title, { x: margin, y: cursorY - size, size, font: boldFont, color: rgb(0.05, 0.05, 0.08) });
    cursorY -= size + 26;
  }

  const bodySize = Math.min(15, pageW / 40);
  for (const line of bodyLines) {
    const wrapped = wrapText(line, font, bodySize, pageW - margin * 2);
    for (const w of wrapped) {
      if (cursorY < margin) break;
      page.drawText(w, { x: margin, y: cursorY - bodySize, size: bodySize, font, color: rgb(0.2, 0.2, 0.2) });
      cursorY -= bodySize + 7;
    }
    cursorY -= 4;
  }

  for (const imgData of images) {
    if (cursorY < margin + 40) break;
    try {
      const jpeg = await sharp(imgData).jpeg({ quality: JPEG_QUALITY[quality] }).toBuffer();
      const meta = await sharp(jpeg).metadata();
      const w = meta.width ?? 300;
      const h = meta.height ?? 200;
      const maxW = pageW - margin * 2;
      const maxH = cursorY - margin;
      const scale = Math.min(1, maxW / w, maxH / h);
      const drawW = w * scale;
      const drawH = h * scale;
      const embedded = await doc.embedJpg(jpeg);
      page.drawImage(embedded, { x: margin, y: cursorY - drawH, width: drawW, height: drawH });
      cursorY -= drawH + 16;
    } catch {
      // Unsupported/corrupt embedded image — skip rather than fail the whole slide.
    }
  }
}

export async function renderBaselineFallback(zip: JSZip, slidePaths: string[], quality: PptToPdfQuality): Promise<Buffer> {
  const [pageW, pageH] = await getSlideSizePt(zip);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const path of slidePaths) {
    await renderSlideToPage(doc, font, boldFont, zip, path, pageW, pageH, quality);
  }
  return Buffer.from(await doc.save());
}

export async function runPptToPdf(fileBuffer: Buffer, filename: string, config: PptToPdfConfig): Promise<PptToPdfResult> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const slideOrder = await getSlideOrder(zip);
  const visibleSlides = config.includeHidden ? slideOrder : slideOrder.filter((s) => !s.hidden);

  let baseline: Buffer;
  if (await checkSofficeAvailable()) {
    const filterData: Record<string, LibreOfficeFilterValue> = {
      ...QUALITY_FILTER[config.quality],
      ExportHiddenSlides: { type: "boolean", value: String(config.includeHidden) },
    };
    const converted = await convertWithLibreOffice(fileBuffer, extOf(filename), "pdf", { filterName: "impress_pdf_Export", filterData });
    if (!converted) throw new Error("PDF conversion isn't available on this server right now.");
    baseline = converted;
  } else {
    baseline = await renderBaselineFallback(
      zip,
      visibleSlides.map((s) => s.path),
      config.quality
    );
  }

  const baselineDoc = await PDFDocument.load(baseline);
  const slideCount = baselineDoc.getPageCount();

  if (config.layout === "single" && !config.addSlideNumbers && !config.includeSpeakerNotesFooter) {
    return { buffer: Buffer.from(await baselineDoc.save()), slideCount, pagesCreated: slideCount };
  }

  const notesCache = config.includeSpeakerNotesFooter
    ? await Promise.all(visibleSlides.map((s) => getNotesText(zip, s.path)))
    : [];

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const embeddedPages = await out.embedPdf(baseline, Array.from({ length: slideCount }, (_, i) => i));

  function drawSlideNumber(page: PDFPage, num: number, x: number, y: number) {
    if (!config.addSlideNumbers) return;
    const text = String(num);
    const size = 9;
    page.drawText(text, { x, y, size, font, color: rgb(0.4, 0.4, 0.4) });
  }

  if (config.layout === "single") {
    const footerBand = config.includeSpeakerNotesFooter ? 26 : 0;
    for (let i = 0; i < embeddedPages.length; i++) {
      const ep = embeddedPages[i];
      const page = out.addPage([ep.width, ep.height + footerBand]);
      page.drawPage(ep, { x: 0, y: footerBand, width: ep.width, height: ep.height });
      if (footerBand > 0) {
        const notes = notesCache[i] || "";
        const line = truncateToWidth(notes ? `Notes: ${notes}` : "Notes: (none)", font, 9, ep.width - 20);
        page.drawText(line, { x: 10, y: 9, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      }
      drawSlideNumber(page, i + 1, ep.width - 28, footerBand + 10);
    }
  } else if (config.layout === "notes") {
    for (let i = 0; i < embeddedPages.length; i++) {
      const ep = embeddedPages[i];
      const page = out.addPage([PAGE_W, PAGE_H]);
      const imgW = PAGE_W - 80;
      const imgH = (imgW * ep.height) / ep.width;
      const imgX = 40;
      const imgY = PAGE_H - 40 - imgH;
      page.drawPage(ep, { x: imgX, y: imgY, width: imgW, height: imgH });
      page.drawRectangle({ x: imgX, y: imgY, width: imgW, height: imgH, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });

      const notes = visibleSlides[i] ? await getNotesText(zip, visibleSlides[i].path) : "";
      const notesLines = wrapText(notes || "No speaker notes for this slide.", font, 11, imgW);
      let ty = imgY - 24;
      for (const line of notesLines) {
        if (ty < 30) break;
        page.drawText(line, { x: imgX, y: ty, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
        ty -= 15;
      }
      drawSlideNumber(page, i + 1, PAGE_W - 40, 14);
    }
  } else {
    const { cols, rows } = HANDOUT_GRID[config.layout];
    const perPage = cols * rows;
    const margin = 30;
    const gap = 12;
    const notesBand = config.includeSpeakerNotesFooter ? 12 : 0;
    const cellW = (PAGE_W - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = (PAGE_H - margin * 2 - gap * (rows - 1)) / rows;

    for (let i = 0; i < embeddedPages.length; i += perPage) {
      const page = out.addPage([PAGE_W, PAGE_H]);
      for (let j = 0; j < perPage && i + j < embeddedPages.length; j++) {
        const ep = embeddedPages[i + j];
        const col = j % cols;
        const row = Math.floor(j / cols);
        const cellX = margin + col * (cellW + gap);
        const cellY = PAGE_H - margin - (row + 1) * cellH - row * gap;

        const imgAreaH = cellH - notesBand;
        const scale = Math.min(cellW / ep.width, imgAreaH / ep.height);
        const w = ep.width * scale;
        const h = ep.height * scale;
        const x = cellX + (cellW - w) / 2;
        const y = cellY + notesBand + (imgAreaH - h) / 2;
        page.drawPage(ep, { x, y, width: w, height: h });
        page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.75 });
        drawSlideNumber(page, i + j + 1, x + w - 16, y + h - 12);
        if (notesBand > 0) {
          const notes = notesCache[i + j] || "";
          const line = truncateToWidth(notes || "(no notes)", font, 7.5, cellW);
          page.drawText(line, { x: cellX, y: cellY + 1, size: 7.5, font, color: rgb(0.5, 0.5, 0.5) });
        }
      }
    }
  }

  const buffer = Buffer.from(await out.save());
  return { buffer, slideCount, pagesCreated: out.getPageCount() };
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${text.slice(0, mid)}…`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo < text.length ? `${text.slice(0, lo)}…` : text;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

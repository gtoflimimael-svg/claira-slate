import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { convertWithLibreOffice, type LibreOfficeFilterValue } from "@/lib/tools/libreoffice";

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

export async function runPptToPdf(fileBuffer: Buffer, filename: string, config: PptToPdfConfig): Promise<PptToPdfResult> {
  const filterData: Record<string, LibreOfficeFilterValue> = {
    ...QUALITY_FILTER[config.quality],
    ExportHiddenSlides: { type: "boolean", value: String(config.includeHidden) },
  };

  const baseline = await convertWithLibreOffice(fileBuffer, extOf(filename), "pdf", {
    filterName: "impress_pdf_Export",
    filterData,
  });
  if (!baseline) {
    throw new Error("PDF conversion isn't available on this server right now.");
  }

  const baselineDoc = await PDFDocument.load(baseline);
  const slideCount = baselineDoc.getPageCount();

  if (config.layout === "single" && !config.addSlideNumbers && !config.includeSpeakerNotesFooter) {
    return { buffer: Buffer.from(await baselineDoc.save()), slideCount, pagesCreated: slideCount };
  }

  const zip = await JSZip.loadAsync(fileBuffer);
  const slideOrder = await getSlideOrder(zip);
  const visibleSlides = config.includeHidden ? slideOrder : slideOrder.filter((s) => !s.hidden);
  const notesCache = config.includeSpeakerNotesFooter
    ? await Promise.all(visibleSlides.map((s) => getNotesText(zip, s.path)))
    : [];

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const embeddedPages = await out.embedPdf(baseline, Array.from({ length: slideCount }, (_, i) => i));

  function drawSlideNumber(page: import("pdf-lib").PDFPage, num: number, x: number, y: number) {
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

function truncateToWidth(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string {
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

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
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

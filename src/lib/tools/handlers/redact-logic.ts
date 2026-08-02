export interface RedactionBox {
  page: number; // 1-indexed
  x: number;
  y: number;
  width: number;
  height: number;
  color: string; // "#rrggbb"
}

export interface AiRedactConfig {
  emails: boolean;
  phones: boolean;
  names: boolean;
  dates: boolean;
  creditCards: boolean;
  ssn: boolean;
  customPattern?: string;
}

export interface RedactConfig {
  redactions: RedactionBox[];
  removeUnderlyingText: boolean;
  removeMetadata: boolean;
  aiRedact?: AiRedactConfig;
}

export interface RedactResult {
  buffer: Buffer;
  redactionCount: number;
  pageCount: number;
}

function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

// Basic Luhn check to cut down false positives from plain digit-run matches.
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?<!\d)(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const CREDIT_CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;
const DATE_RE = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4})\b/gi;
// Crude heuristic, not real NLP: two or three capitalized words in a row.
// Flags real names but also places, titles, etc — a best-effort Pro feature,
// not a precise named-entity recognizer.
const NAME_RE = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g;

function findAiMatches(text: string, ai: AiRedactConfig): Set<string> {
  const matches = new Set<string>();
  const collect = (re: RegExp, filter?: (m: string) => boolean) => {
    for (const m of text.matchAll(re)) {
      const value = m[0];
      if (!filter || filter(value)) matches.add(value);
    }
  };
  if (ai.emails) collect(EMAIL_RE);
  if (ai.phones) collect(PHONE_RE, (v) => v.replace(/\D/g, "").length >= 10);
  if (ai.ssn) collect(SSN_RE);
  if (ai.dates) collect(DATE_RE);
  if (ai.creditCards) collect(CREDIT_CARD_RE, (v) => passesLuhn(v.replace(/[ -]/g, "")));
  if (ai.names) collect(NAME_RE);
  if (ai.customPattern) {
    try {
      collect(new RegExp(ai.customPattern, "g"));
    } catch {
      // Invalid user-supplied regex — ignore rather than fail the whole redaction.
    }
  }
  return matches;
}

function quadToRect(quad: number[]): [number, number, number, number] {
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export async function runRedact(fileBuffer: Buffer, config: RedactConfig): Promise<RedactResult> {
  const mupdf = await import("mupdf");
  const opened = mupdf.Document.openDocument(fileBuffer, "application/pdf");
  const doc = opened.asPDF();
  if (!doc) throw new Error("That file isn't a valid PDF.");

  const pageCount = doc.countPages();
  const boxesByPage = new Map<number, RedactionBox[]>();
  for (const box of config.redactions) {
    const list = boxesByPage.get(box.page) ?? [];
    list.push(box);
    boxesByPage.set(box.page, list);
  }

  if (config.aiRedact) {
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const stext = page.toStructuredText();
      const matches = findAiMatches(stext.asText(), config.aiRedact);
      if (matches.size === 0) continue;
      const list = boxesByPage.get(i + 1) ?? [];
      for (const match of matches) {
        for (const quad of stext.search(match)) {
          for (const q of quad) {
            const [x0, y0, x1, y1] = quadToRect(q as unknown as number[]);
            list.push({ page: i + 1, x: x0, y: y0, width: x1 - x0, height: y1 - y0, color: "#000000" });
          }
        }
      }
      boxesByPage.set(i + 1, list);
    }
  }

  let redactionCount = 0;
  const textMethod = config.removeUnderlyingText ? mupdf.PDFPage.REDACT_TEXT_REMOVE : mupdf.PDFPage.REDACT_TEXT_NONE;

  for (const [pageNum, boxes] of boxesByPage) {
    if (pageNum < 1 || pageNum > pageCount || boxes.length === 0) continue;
    const page = doc.loadPage(pageNum - 1) as import("mupdf").PDFPage;

    // A bare "Redact" annotation crashes mupdf's setInteriorColor binding, so
    // the visible fill is drawn separately: redact with black_boxes=false
    // (content genuinely removed, nothing drawn), then stamp a colored
    // "Square" annotation — which does support interior color — on top.
    for (const box of boxes) {
      const redactAnnot = page.createAnnotation("Redact");
      redactAnnot.setRect([box.x, box.y, box.x + box.width, box.y + box.height]);
    }
    page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_PIXELS, mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_COVERED, textMethod);

    for (const box of boxes) {
      const square = page.createAnnotation("Square");
      square.setRect([box.x, box.y, box.x + box.width, box.y + box.height]);
      const rgb = hexToRgb01(box.color);
      square.setInteriorColor(rgb);
      square.setColor(rgb);
      square.setBorderWidth(0);
      redactionCount++;
    }
  }

  if (config.removeMetadata) {
    for (const key of ["info:Title", "info:Author", "info:Subject", "info:Keywords", "info:Creator", "info:Producer"]) {
      doc.setMetaData(key, "");
    }
  }

  const buffer = doc.saveToBuffer({});
  return { buffer: Buffer.from(buffer.asUint8Array()), redactionCount, pageCount };
}

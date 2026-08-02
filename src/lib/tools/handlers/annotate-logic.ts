import { hexToRgb01 } from "@/lib/tools/handlers/pdf-text-style";

export type AnnotationType =
  | "highlight"
  | "underline"
  | "strikethrough"
  | "comment"
  | "textbox"
  | "draw"
  | "arrow"
  | "rectangle"
  | "ellipse";

export interface AnnotationInput {
  type: AnnotationType;
  page: number; // 1-indexed
  color: string; // "#rrggbb"
  opacity: number; // 0-1
  text?: string; // comment / textbox content
  thickness?: number; // draw / arrow / rectangle / ellipse stroke width, in PDF points
  fontSize?: number; // textbox
  quads?: number[][]; // highlight / underline / strikethrough — one 8-number quad per covered text line, PDF point space
  rect?: [number, number, number, number]; // comment / textbox / rectangle / ellipse — [x0, y0, x1, y1], PDF point space
  line?: [number, number, number, number]; // arrow — [x1, y1, x2, y2], PDF point space
  points?: number[][][]; // draw — one array of [x, y] points per stroke, PDF point space
}

export interface AnnotateResult {
  buffer: Buffer;
  annotationCount: number;
  pageCount: number;
}

export async function runAnnotate(fileBuffer: Buffer, annotations: AnnotationInput[]): Promise<AnnotateResult> {
  const mupdf = await import("mupdf");
  const opened = mupdf.Document.openDocument(fileBuffer, "application/pdf");
  const doc = opened.asPDF();
  if (!doc) throw new Error("That file isn't a valid PDF.");

  const pageCount = doc.countPages();
  let annotationCount = 0;

  for (const input of annotations) {
    if (input.page < 1 || input.page > pageCount) continue;
    const page = doc.loadPage(input.page - 1) as import("mupdf").PDFPage;
    const rgb = hexToRgb01(input.color);

    try {
      switch (input.type) {
        case "highlight":
        case "underline":
        case "strikethrough": {
          if (!input.quads || input.quads.length === 0) continue;
          const pdfType = input.type === "highlight" ? "Highlight" : input.type === "underline" ? "Underline" : "StrikeOut";
          const annot = page.createAnnotation(pdfType);
          annot.setQuadPoints(input.quads as unknown as import("mupdf").Quad[]);
          annot.setColor(rgb);
          annot.setOpacity(input.opacity);
          annot.update();
          break;
        }
        case "comment": {
          if (!input.rect) continue;
          const annot = page.createAnnotation("Text");
          annot.setRect(input.rect);
          annot.setContents(input.text ?? "");
          annot.setColor(rgb);
          annot.setOpacity(input.opacity);
          annot.setIcon("Comment");
          annot.update();
          break;
        }
        case "textbox": {
          if (!input.rect) continue;
          const annot = page.createAnnotation("FreeText");
          annot.setRect(input.rect);
          annot.setContents(input.text ?? "");
          annot.setDefaultAppearance("Helv", input.fontSize ?? 12, rgb);
          annot.setBorderWidth(0);
          annot.setOpacity(input.opacity);
          annot.update();
          break;
        }
        case "draw": {
          if (!input.points || input.points.length === 0) continue;
          const annot = page.createAnnotation("Ink");
          annot.setInkList(input.points as unknown as import("mupdf").Point[][]);
          annot.setColor(rgb);
          annot.setBorderWidth(input.thickness ?? 2);
          annot.setOpacity(input.opacity);
          annot.update();
          break;
        }
        case "arrow": {
          if (!input.line) continue;
          const [x1, y1, x2, y2] = input.line;
          const annot = page.createAnnotation("Line");
          annot.setLine([x1, y1], [x2, y2]);
          annot.setLineEndingStyles("None", "ClosedArrow");
          annot.setColor(rgb);
          annot.setInteriorColor(rgb);
          annot.setBorderWidth(input.thickness ?? 2);
          annot.setOpacity(input.opacity);
          annot.update();
          break;
        }
        case "rectangle":
        case "ellipse": {
          if (!input.rect) continue;
          const annot = page.createAnnotation(input.type === "rectangle" ? "Square" : "Circle");
          annot.setRect(input.rect);
          annot.setColor(rgb);
          annot.setBorderWidth(input.thickness ?? 2);
          annot.setOpacity(input.opacity);
          annot.update();
          break;
        }
      }
      annotationCount++;
    } catch {
      // Skip any single annotation mupdf's WASM binding rejects rather than
      // failing the whole batch — matches the defensive per-item handling
      // already used elsewhere in this codebase (e.g. OCR's per-line drawText).
    }
  }

  const buffer = doc.saveToBuffer({});
  return { buffer: Buffer.from(buffer.asUint8Array()), annotationCount, pageCount };
}

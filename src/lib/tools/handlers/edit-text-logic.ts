import { PDFDocument, rgb } from "pdf-lib";
import { fontFor, hexToRgb01 } from "@/lib/tools/handlers/pdf-text-style";

export type TextAlignment = "left" | "center" | "right";

export interface TextEdit {
  page: number; // 1-indexed
  x: number; // PDF point space, left edge of the original/new text box
  y: number; // PDF point space, baseline of the first line
  width?: number; // original text box width, in points — used to white-out and to align within
  height?: number; // original text box height, in points — used to size the white-out rect
  newText: string;
  fontSize: number;
  color: string; // "#rrggbb"
  bold: boolean;
  italic: boolean;
  alignment: TextAlignment;
  isNew: boolean;
}

export interface EditTextResult {
  buffer: Buffer;
  blocksEdited: number;
}

const LINE_HEIGHT_RATIO = 1.25;
const WHITEOUT_PADDING = 1.5;

export async function runEditText(fileBuffer: Buffer, edits: TextEdit[]): Promise<EditTextResult> {
  const doc = await PDFDocument.load(fileBuffer);
  const pages = doc.getPages();
  let blocksEdited = 0;

  for (const edit of edits) {
    if (edit.page < 1 || edit.page > pages.length) continue;
    const page = pages[edit.page - 1];
    const font = await fontFor(doc, "helvetica", edit.bold, edit.italic);
    const [r, g, b] = hexToRgb01(edit.color);

    if (!edit.isNew && edit.width && edit.height) {
      page.drawRectangle({
        x: edit.x - WHITEOUT_PADDING,
        y: edit.y - edit.height * 0.3 - WHITEOUT_PADDING,
        width: edit.width + WHITEOUT_PADDING * 2,
        height: edit.height + WHITEOUT_PADDING * 2,
        color: rgb(1, 1, 1),
      });
    }

    const lines = edit.newText.split("\n");
    lines.forEach((line, i) => {
      const lineWidth = font.widthOfTextAtSize(line, edit.fontSize);
      let x = edit.x;
      if (edit.width && edit.alignment === "center") x = edit.x + (edit.width - lineWidth) / 2;
      else if (edit.width && edit.alignment === "right") x = edit.x + edit.width - lineWidth;
      page.drawText(line, {
        x,
        y: edit.y - i * edit.fontSize * LINE_HEIGHT_RATIO,
        size: edit.fontSize,
        font,
        color: rgb(r, g, b),
      });
    });

    blocksEdited++;
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer, blocksEdited };
}

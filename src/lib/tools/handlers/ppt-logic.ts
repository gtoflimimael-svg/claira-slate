import { PDFParse } from "pdf-parse";
import PptxGenJS from "pptxgenjs";
import { sniffImageType } from "@/lib/tools/image-format";

export type PptLayout = "widescreen" | "standard";

export interface PptConfig {
  layout: PptLayout;
  includeImages: boolean;
  includeTables: boolean;
  addSlideNumbers: boolean;
}

export interface PptResult {
  buffer: Buffer;
  slidesCreated: number;
  imagesEmbedded: number;
}

const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", bmp: "image/bmp" };

// Same crude heuristic as word-logic.ts: pdf-parse's getText() doesn't expose
// per-run font size, so a short line without sentence-ending punctuation is
// treated as a slide title instead of a font-size measurement.
function isLikelyHeading(line: string): boolean {
  return line.length > 0 && line.length <= 70 && !/[.,;:]$/.test(line);
}

export async function runPdfToPpt(fileBuffer: Buffer, config: PptConfig): Promise<PptResult> {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const textResult = await parser.getText({ pageJoiner: "" });

    const imagesByPage = new Map<number, Awaited<ReturnType<PDFParse["getImage"]>>["pages"][number]["images"]>();
    if (config.includeImages) {
      const imageResult = await parser.getImage({ imageBuffer: true, imageDataUrl: false });
      for (const p of imageResult.pages) imagesByPage.set(p.pageNumber, p.images);
    }

    const tablesByPage = new Map<number, string[][][]>();
    if (config.includeTables) {
      const tableResult = await parser.getTable();
      for (const p of tableResult.pages) tablesByPage.set(p.num, p.tables);
    }

    const pptx = new PptxGenJS();
    pptx.layout = config.layout === "widescreen" ? "LAYOUT_16x9" : "LAYOUT_4x3";
    const slideWidth = config.layout === "widescreen" ? 10 : 10;
    const slideHeight = config.layout === "widescreen" ? 5.625 : 7.5;

    let imagesEmbedded = 0;

    for (const page of textResult.pages) {
      const slide = pptx.addSlide();
      if (config.addSlideNumbers) {
        slide.slideNumber = { x: slideWidth - 0.6, y: slideHeight - 0.4, fontSize: 10, color: "999999" };
      }

      const rawLines = page.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const title = rawLines.find((l) => isLikelyHeading(l)) ?? `Page ${page.num}`;
      const bodyLines = rawLines.filter((l) => l !== title);

      slide.addText(title, {
        x: 0.5,
        y: 0.35,
        w: slideWidth - 1,
        h: 0.7,
        fontSize: 24,
        bold: true,
        color: "1A1A1A",
        fontFace: "Arial",
      });

      let cursorY = 1.2;
      if (bodyLines.length > 0) {
        const bodyText = bodyLines.map((line) => ({ text: line, options: { bullet: true, breakLine: true } }));
        const bodyHeight = Math.min(slideHeight - cursorY - 0.4, Math.max(1, bodyLines.length * 0.35));
        slide.addText(bodyText, {
          x: 0.5,
          y: cursorY,
          w: slideWidth - 1,
          h: bodyHeight,
          fontSize: 14,
          color: "333333",
          fontFace: "Arial",
          valign: "top",
        });
        cursorY += bodyHeight + 0.2;
      }

      const tables = tablesByPage.get(page.num);
      if (tables) {
        for (const table of tables) {
          if (table.length === 0 || cursorY >= slideHeight - 0.5) continue;
          const rows = table.map((row) => row.map((cell) => ({ text: cell ?? "", options: { fontSize: 10 } })));
          const tableHeight = Math.min(slideHeight - cursorY - 0.3, table.length * 0.3);
          slide.addTable(rows, { x: 0.5, y: cursorY, w: slideWidth - 1, h: tableHeight, fontSize: 10, border: { type: "solid", color: "CCCCCC", pt: 0.5 } });
          cursorY += tableHeight + 0.2;
        }
      }

      const images = imagesByPage.get(page.num);
      if (images) {
        for (const img of images) {
          if (cursorY >= slideHeight - 0.5) break;
          const type = sniffImageType(img.data);
          if (!type) continue;
          const mime = IMAGE_MIME[type];
          const maxWidth = slideWidth - 1;
          const aspect = img.height / img.width;
          const width = Math.min(maxWidth, 4);
          const height = Math.min(width * aspect, slideHeight - cursorY - 0.3);
          slide.addImage({
            data: `data:${mime};base64,${Buffer.from(img.data).toString("base64")}`,
            x: 0.5,
            y: cursorY,
            w: width,
            h: height,
          });
          cursorY += height + 0.2;
          imagesEmbedded++;
        }
      }
    }

    if (textResult.pages.length === 0) {
      pptx.addSlide().addText("This PDF had no extractable content.", { x: 0.5, y: 0.5, w: slideWidth - 1, h: 1, fontSize: 16 });
    }

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    return { buffer, slidesCreated: textResult.total, imagesEmbedded };
  } finally {
    await parser.destroy();
  }
}

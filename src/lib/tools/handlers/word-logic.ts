import { PDFParse } from "pdf-parse";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell } from "docx";
import { sniffImageType } from "@/lib/tools/image-format";

export type WordMode = "flowing" | "exact";

export interface WordConfig {
  mode: WordMode;
  preserveFormatting: boolean;
  convertTables: boolean;
  embedImages: boolean;
  language: string;
}

export interface WordResult {
  buffer: Buffer;
  pagesConverted: number;
  imagesExtracted: number;
}

// A crude but honest heading heuristic: pdf-parse's getText() doesn't expose
// per-run font size (only line-broken page text), so true "map font sizes to
// heading levels" isn't possible through this API. A short line (no
// sentence-ending punctuation) is treated as a heading instead — a
// reasonable approximation, not a font-size measurement.
function isLikelyHeading(line: string): boolean {
  return line.length > 0 && line.length <= 70 && !/[.,;:]$/.test(line);
}

export async function runPdfToWord(fileBuffer: Buffer, config: WordConfig): Promise<WordResult> {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const textResult = await parser.getText({ pageJoiner: "" });

    const imagesByPage = new Map<number, Awaited<ReturnType<PDFParse["getImage"]>>["pages"][number]["images"]>();
    if (config.embedImages) {
      const imageResult = await parser.getImage({ imageBuffer: true, imageDataUrl: false });
      for (const p of imageResult.pages) imagesByPage.set(p.pageNumber, p.images);
    }

    const tablesByPage = new Map<number, string[][][]>();
    if (config.convertTables) {
      const tableResult = await parser.getTable();
      for (const p of tableResult.pages) tablesByPage.set(p.num, p.tables);
    }

    const children: (Paragraph | Table)[] = [];
    let imagesExtracted = 0;

    for (const page of textResult.pages) {
      const rawLines = page.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      // "Flowing text": merge wrapped lines back into paragraphs (a line
      // that doesn't end a sentence is assumed to wrap into the next one).
      // "Exact layout": keep each line from the source as its own
      // paragraph, closer to the PDF's original visual line breaks.
      const lines: string[] =
        config.mode === "exact"
          ? rawLines
          : rawLines.reduce<string[]>((acc, line) => {
              const prev = acc[acc.length - 1];
              if (prev && !/[.!?:;]$/.test(prev) && !isLikelyHeading(prev)) {
                acc[acc.length - 1] = `${prev} ${line}`;
              } else {
                acc.push(line);
              }
              return acc;
            }, []);

      for (const line of lines) {
        const heading = isLikelyHeading(line);
        children.push(
          new Paragraph({
            heading: heading ? HeadingLevel.HEADING_2 : undefined,
            children: [
              new TextRun({
                text: line,
                bold: config.preserveFormatting && heading,
              }),
            ],
          })
        );
      }

      const tables = tablesByPage.get(page.num);
      if (tables) {
        for (const table of tables) {
          if (table.length === 0) continue;
          children.push(
            new Table({
              rows: table.map(
                (row) =>
                  new TableRow({
                    children: row.map(
                      (cell) =>
                        new TableCell({
                          children: [new Paragraph({ children: [new TextRun(cell ?? "")] })],
                        })
                    ),
                  })
              ),
            })
          );
        }
      }

      const images = imagesByPage.get(page.num);
      if (images) {
        for (const img of images) {
          const type = sniffImageType(img.data);
          if (!type) continue;
          const maxWidth = 500;
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  type,
                  data: img.data,
                  transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
                }),
              ],
            })
          );
          imagesExtracted++;
        }
      }
    }

    if (children.length === 0) {
      children.push(new Paragraph({ children: [new TextRun("")] }));
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    return { buffer, pagesConverted: textResult.total, imagesExtracted };
  } finally {
    await parser.destroy();
  }
}

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let gsAvailable: boolean | null = null;

export async function checkGhostscriptAvailable(): Promise<boolean> {
  if (gsAvailable !== null) return gsAvailable;
  const available = await new Promise<boolean>((resolve) => {
    const check = spawn("which", ["gs"]);
    check.on("close", (code) => resolve(code === 0));
    check.on("error", () => resolve(false));
  });
  gsAvailable = available;
  return available;
}

/**
 * Converts a PDF to PDF/A via Ghostscript's `-dPDFA` writer, the same real
 * conversion path `mutool`/most PDF/A tools use under the hood — not
 * available by default on Vercel's serverless runtime, hence the
 * availability check callers are expected to make first.
 */
export async function convertToPdfA(inputBuffer: Buffer, part: 1 | 2 | 3): Promise<Buffer | null> {
  if (!(await checkGhostscriptAvailable())) return null;

  const dir = await mkdtemp(path.join(tmpdir(), "cs-pdfa-"));
  try {
    const inputPath = path.join(dir, "input.pdf");
    const outputPath = path.join(dir, "output.pdf");
    await writeFile(inputPath, inputBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("gs", [
        `-dPDFA=${part}`,
        "-dBATCH",
        "-dNOPAUSE",
        "-dNOOUTERSAVE",
        "-dPDFACompatibilityPolicy=1",
        "-sColorConversionStrategy=RGB",
        "-sProcessColorModel=DeviceRGB",
        "-sDEVICE=pdfwrite",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`gs exited ${code}: ${stderr}`))));
      proc.on("error", reject);
    });

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

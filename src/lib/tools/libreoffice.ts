import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let sofficeAvailable: boolean | null = null;

async function checkSofficeAvailable(): Promise<boolean> {
  if (sofficeAvailable !== null) return sofficeAvailable;
  const available = await new Promise<boolean>((resolve) => {
    const check = spawn("which", ["soffice"]);
    check.on("close", (code) => resolve(code === 0));
    check.on("error", () => resolve(false));
  });
  sofficeAvailable = available;
  return available;
}

/**
 * Converts a file to another format via LibreOffice's headless CLI. Returns
 * null (instead of throwing) when `soffice` isn't installed, so callers can
 * fall back to a "coming soon" response rather than crashing.
 */
export async function convertWithLibreOffice(
  inputBuffer: Buffer,
  inputExt: string,
  outputExt: string
): Promise<Buffer | null> {
  if (!(await checkSofficeAvailable())) return null;

  const dir = await mkdtemp(path.join(tmpdir(), "cs-office-"));
  try {
    const inputPath = path.join(dir, `input.${inputExt}`);
    await writeFile(inputPath, inputBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("soffice", [
        "--headless",
        "--norestore",
        "--convert-to",
        outputExt,
        "--outdir",
        dir,
        inputPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`soffice exited ${code}: ${stderr}`))));
      proc.on("error", reject);
    });

    const outputPath = path.join(dir, `input.${outputExt}`);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

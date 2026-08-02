export interface UnlockResult {
  buffer: Buffer;
}

export class WrongPasswordError extends Error {
  constructor() {
    super("That password doesn't match this file. Double-check it and try again.");
    this.name = "WrongPasswordError";
  }
}

export async function runUnlock(fileBuffer: Buffer, password: string): Promise<UnlockResult> {
  const mupdf = await import("mupdf");
  const opened = mupdf.Document.openDocument(fileBuffer, "application/pdf");
  const doc = opened.asPDF();
  if (!doc) throw new Error("That file isn't a valid PDF.");

  if (doc.needsPassword()) {
    const authResult = doc.authenticatePassword(password);
    if (authResult === 0) throw new WrongPasswordError();
  }

  const buffer = doc.saveToBuffer({ encrypt: "no" });
  return { buffer: Buffer.from(buffer.asUint8Array()) };
}

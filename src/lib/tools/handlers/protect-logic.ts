import crypto from "node:crypto";

export type Encryption = "aes128" | "aes256";

export interface ProtectPermissions {
  print: boolean;
  copy: boolean;
  edit: boolean;
  annotate: boolean;
  fillForms: boolean;
}

export interface ProtectConfig {
  openPassword: string;
  permissionsPassword: string | null;
  permissions: ProtectPermissions;
  encryption: Encryption;
}

export interface ProtectResult {
  buffer: Buffer;
}

const PERM_BIT = { print: 1 << 2, edit: 1 << 3, copy: 1 << 4, annotate: 1 << 5, fillForms: 1 << 8 };

function permissionsToBitmask(p: ProtectPermissions): number {
  // -4 (0xFFFFFFFC) is the conventional "allow everything" baseline used by
  // PDF tools — bits 1-2 are reserved/must be 0, every other bit defaults
  // to 1. Disallowed permissions clear their specific bit from there.
  let mask = -4;
  if (!p.print) mask &= ~PERM_BIT.print;
  if (!p.edit) mask &= ~PERM_BIT.edit;
  if (!p.copy) mask &= ~PERM_BIT.copy;
  if (!p.annotate) mask &= ~PERM_BIT.annotate;
  if (!p.fillForms) mask &= ~PERM_BIT.fillForms;
  return mask;
}

export async function runProtect(fileBuffer: Buffer, config: ProtectConfig): Promise<ProtectResult> {
  // Loaded lazily, not as a static top-level import: mupdf is an ESM module
  // with top-level await, and this codebase's other heavy/native-ish
  // dependencies (LibreOffice/pdf-parse's canvas backend) are already kept
  // out of the static import graph the same way — see dispatch.ts.
  const mupdf = await import("mupdf");
  const opened = mupdf.Document.openDocument(fileBuffer, "application/pdf");
  const doc = opened.asPDF();
  if (!doc) throw new Error("That file isn't a valid PDF.");
  // A restricted-permissions PDF is only meaningful with an owner password
  // distinct from the user password — generate one when the (Pro-only)
  // custom permissions password is left blank, so free-tier restrictions
  // still actually apply rather than being silently no-ops.
  const ownerPassword = config.permissionsPassword || crypto.randomBytes(16).toString("hex");

  const buffer = doc.saveToBuffer({
    encrypt: config.encryption === "aes256" ? "aes-256" : "aes-128",
    "user-password": config.openPassword,
    "owner-password": ownerPassword,
    permissions: String(permissionsToBitmask(config.permissions)),
  });

  return { buffer: Buffer.from(buffer.asUint8Array()) };
}

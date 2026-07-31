import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runSplit } from "@/lib/tools/handlers/split-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

interface ExtractConfig {
  pages: number[]; // 1-indexed
  mode: "single" | "per-page";
  fileNames?: string[];
}

// The upgraded Extract Pages tool's two output modes ("single" = one PDF
// with the selected pages, "per-page" = one PDF per selected page, zipped)
// are exactly what split-logic.ts's "pages" mode already does via its
// mergePages flag — so this dedicated route (bypassing the generic
// /api/tools/[tool] dispatcher, same as /api/tools/split) reuses runSplit()
// rather than duplicating page-extraction logic. Does not touch
// dispatch.ts, the existing generic "extract-pages" tool entry, or any
// other route.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const file = formData.get("file");
  const configRaw = formData.get("config");
  if (!(file instanceof File) || typeof configRaw !== "string") {
    return NextResponse.json({ error: "Missing 'file' or 'config' in form data." }, { status: 400 });
  }

  let config: ExtractConfig;
  try {
    config = JSON.parse(configRaw);
  } catch {
    return NextResponse.json({ error: "Invalid extract configuration." }, { status: 400 });
  }
  if (!Array.isArray(config.pages) || config.pages.length === 0) {
    return NextResponse.json({ error: "No pages selected." }, { status: 400 });
  }

  let plan: "free" | "pro" | "business" = "free";
  if (user) {
    const quota = await enforceTaskQuota(user.id);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
    }
    plan = quota.plan;
  }

  const sizeCheck = checkFileSize({ size: file.size }, plan);
  if (!sizeCheck.allowed) {
    return NextResponse.json(
      { error: `File too large for your plan (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = file.name.replace(/\.pdf$/i, "") || "document";

  let outputs;
  try {
    outputs = await runSplit(buffer, baseName, {
      mode: "pages",
      selectedPages: config.pages,
      mergePages: config.mode === "single",
      fileNames: config.fileNames,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't extract these pages." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const uploaded = await Promise.all(
    outputs.map(async (o) => {
      const r2Key = `processed/${owner}/${crypto.randomUUID()}-${o.filename}`;
      await uploadToR2(r2Key, o.buffer, "application/pdf");
      const downloadUrl = await getSignedDownloadUrl(r2Key, o.filename, 3600);
      return { filename: o.filename, r2Key, downloadUrl, size: o.buffer.byteLength, pages: o.pages };
    })
  );

  let zip: { downloadUrl: string; r2Key: string; filename: string } | null = null;
  if (uploaded.length > 1) {
    const zipArchive = new JSZip();
    outputs.forEach((o) => zipArchive.file(o.filename, o.buffer));
    const zipBuffer = await zipArchive.generateAsync({ type: "nodebuffer" });
    const zipFilename = `extracted-${baseName}.zip`;
    const zipKey = `processed/${owner}/${crypto.randomUUID()}-${zipFilename}`;
    await uploadToR2(zipKey, zipBuffer, "application/zip");
    zip = { downloadUrl: await getSignedDownloadUrl(zipKey, zipFilename, 3600), r2Key: zipKey, filename: zipFilename };
  }

  if (user) {
    const totalBytes = uploaded.reduce((sum, f) => sum + f.size, 0);
    const primaryKey = zip?.r2Key ?? uploaded[0]?.r2Key;
    if (primaryKey) await logToolUsage(user.id, "extract-pages", zip?.filename ?? uploaded[0].filename, totalBytes, primaryKey);
  }

  let originalPages: number | null = null;
  try {
    originalPages = (await PDFDocument.load(buffer, { ignoreEncryption: true })).getPageCount();
  } catch {
    originalPages = null;
  }

  return NextResponse.json({
    files: uploaded,
    zip,
    originalPages,
    plan,
    loggedIn: !!user,
  });
}

import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runCompress, type CompressLevel } from "@/lib/tools/handlers/compress-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

interface CompressBody {
  level: CompressLevel;
  quality?: number;
}

// Dedicated route (bypasses the generic /api/tools/[tool] dispatcher, same
// as split/organize/rotate/extract-pages/delete-pages) — the upgraded
// Compress tool takes multiple files, a preset level OR a paid-plan-only
// custom quality, and returns a ZIP when there's more than one output.
// Reuses compress-logic.ts rather than the generic dispatcher's existing
// "compress"/"optimize"/"grayscale" tools, which are untouched.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const fileEntries = formData.getAll("file").filter((f): f is File => f instanceof File);
  const configRaw = formData.get("config");
  if (fileEntries.length === 0 || typeof configRaw !== "string") {
    return NextResponse.json({ error: "Missing 'file' or 'config' in form data." }, { status: 400 });
  }

  let config: CompressBody;
  try {
    config = JSON.parse(configRaw);
  } catch {
    return NextResponse.json({ error: "Invalid compress configuration." }, { status: 400 });
  }
  if (!["extreme", "recommended", "less"].includes(config.level)) {
    return NextResponse.json({ error: "Invalid compression level." }, { status: 400 });
  }

  let plan: "free" | "pro" | "business" = "free";
  if (user) {
    const quota = await enforceTaskQuota(user.id);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
    }
    plan = quota.plan;
  }

  if (config.quality !== undefined) {
    if (plan === "free") {
      return NextResponse.json({ error: "Custom quality is a Pro feature. Upgrade to unlock it.", plan }, { status: 403 });
    }
    if (typeof config.quality !== "number" || config.quality < 10 || config.quality > 100) {
      return NextResponse.json({ error: "Quality must be between 10 and 100." }, { status: 400 });
    }
  }

  for (const file of fileEntries) {
    const sizeCheck = checkFileSize({ size: file.size }, plan);
    if (!sizeCheck.allowed) {
      return NextResponse.json(
        { error: `File too large for your plan (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).` },
        { status: 413 }
      );
    }
  }

  const owner = user ? user.id : "anonymous";
  let outputs;
  try {
    outputs = await Promise.all(
      fileEntries.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const baseName = file.name.replace(/\.pdf$/i, "") || "document";
        return runCompress(buffer, `${baseName}.pdf`, { level: config.level, quality: config.quality });
      })
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't compress these PDFs." }, { status: 400 });
  }

  const uploaded = await Promise.all(
    outputs.map(async (o) => {
      const r2Key = `processed/${owner}/${crypto.randomUUID()}-${o.filename}`;
      await uploadToR2(r2Key, o.buffer, "application/pdf");
      const downloadUrl = await getSignedDownloadUrl(r2Key, o.filename, 3600);
      return { filename: o.filename, r2Key, downloadUrl, originalSize: o.originalSize, size: o.size, pages: o.pages };
    })
  );

  let zip: { downloadUrl: string; r2Key: string; filename: string } | null = null;
  if (uploaded.length > 1) {
    const zipArchive = new JSZip();
    outputs.forEach((o) => zipArchive.file(o.filename, o.buffer));
    const zipBuffer = await zipArchive.generateAsync({ type: "nodebuffer" });
    const zipFilename = "compressed.zip";
    const zipKey = `processed/${owner}/${crypto.randomUUID()}-${zipFilename}`;
    await uploadToR2(zipKey, zipBuffer, "application/zip");
    zip = { downloadUrl: await getSignedDownloadUrl(zipKey, zipFilename, 3600), r2Key: zipKey, filename: zipFilename };
  }

  if (user) {
    const totalBytes = uploaded.reduce((sum, f) => sum + f.size, 0);
    const primaryKey = zip?.r2Key ?? uploaded[0]?.r2Key;
    if (primaryKey) await logToolUsage(user.id, "compress", zip?.filename ?? uploaded[0].filename, totalBytes, primaryKey);
  }

  return NextResponse.json({
    files: uploaded,
    zip,
    plan,
    loggedIn: !!user,
  });
}

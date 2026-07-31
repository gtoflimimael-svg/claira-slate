import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runSplit, type SplitConfig } from "@/lib/tools/handlers/split-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

// Split's UI needs an individually-downloadable + individually-renamed file
// per resulting chunk (plus an all-in-one zip), which the generic
// /api/tools/[tool] route can't express — it returns exactly one output. This
// dedicated route (more specific than the [tool] catch-all, so Next.js routes
// here for this exact path) covers that. It intentionally does NOT touch
// dispatch.ts or any other tool's handler.
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

  let config: SplitConfig;
  try {
    config = JSON.parse(configRaw);
  } catch {
    return NextResponse.json({ error: "Invalid split configuration." }, { status: 400 });
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

  if (config.mode === "smart") {
    return NextResponse.json({
      comingSoon: true,
      message: "Smart AI-powered split is a Pro feature that's coming soon. Try Range, Pages, or Size splitting instead.",
      plan,
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = file.name.replace(/\.pdf$/i, "") || "document";

  let outputs;
  try {
    outputs = await runSplit(buffer, baseName, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't split this PDF." }, { status: 400 });
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
    const zipFilename = `split-${baseName}.zip`;
    const zipKey = `processed/${owner}/${crypto.randomUUID()}-${zipFilename}`;
    await uploadToR2(zipKey, zipBuffer, "application/zip");
    zip = { downloadUrl: await getSignedDownloadUrl(zipKey, zipFilename, 3600), r2Key: zipKey, filename: zipFilename };
  }

  if (user) {
    const totalBytes = uploaded.reduce((sum, f) => sum + f.size, 0);
    const primaryKey = zip?.r2Key ?? uploaded[0]?.r2Key;
    if (primaryKey) await logToolUsage(user.id, "split", zip?.filename ?? uploaded[0].filename, totalBytes, primaryKey);
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

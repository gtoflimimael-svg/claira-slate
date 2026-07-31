import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runSplit } from "@/lib/tools/handlers/split-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

interface DeleteConfig {
  pagesToDelete: number[]; // 1-indexed
}

// Deleting pages is the complement of extracting them: keep every page NOT
// in pagesToDelete, merged into a single PDF. That's runSplit()'s "pages"
// mode with mergePages=true, so this dedicated route (bypassing the generic
// /api/tools/[tool] dispatcher, same as split/organize/rotate/extract-pages)
// reuses it rather than duplicating page-removal logic. Does not touch
// dispatch.ts, the existing generic "delete-pages" tool entry, or any other
// route.
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

  let config: DeleteConfig;
  try {
    config = JSON.parse(configRaw);
  } catch {
    return NextResponse.json({ error: "Invalid delete configuration." }, { status: 400 });
  }
  if (!Array.isArray(config.pagesToDelete) || config.pagesToDelete.length === 0) {
    return NextResponse.json({ error: "No pages marked for deletion." }, { status: 400 });
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

  let total: number;
  try {
    total = (await PDFDocument.load(buffer, { ignoreEncryption: true })).getPageCount();
  } catch {
    return NextResponse.json({ error: "Couldn't read this PDF." }, { status: 400 });
  }

  const toDelete = new Set(config.pagesToDelete.filter((p) => p >= 1 && p <= total));
  if (toDelete.size >= total) {
    return NextResponse.json({ error: "Can't delete every page — at least one page must remain." }, { status: 400 });
  }
  const keepPages = Array.from({ length: total }, (_, i) => i + 1).filter((p) => !toDelete.has(p));

  let outputs;
  try {
    outputs = await runSplit(buffer, baseName, { mode: "pages", selectedPages: keepPages, mergePages: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't delete these pages." }, { status: 400 });
  }
  const result = outputs[0];

  const owner = user ? user.id : "anonymous";
  const filename = `${baseName}.pdf`;
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "delete-pages", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pages,
    originalSize: buffer.byteLength,
    originalPages: total,
    deletedCount: toDelete.size,
    plan,
    loggedIn: !!user,
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runOptimize, type OptimizeConfig } from "@/lib/tools/handlers/optimize-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

// Dedicated route (bypasses the generic /api/tools/[tool] dispatcher). The
// upgraded Optimize tool is real pdf-lib metadata/JS/annotation cleanup —
// unrelated to the generic dispatcher's existing raster-based "optimize"
// tool (raster-tools.ts), which is left untouched; this path simply takes
// priority for this exact URL, same as split/organize/rotate/etc.
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

  let config: OptimizeConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      removeMetadata: !!parsed.removeMetadata,
      removeThumbnails: !!parsed.removeThumbnails,
      flattenForms: !!parsed.flattenForms,
      removeJS: !!parsed.removeJS,
      removeAnnotations: !!parsed.removeAnnotations,
      target: ["web", "email", "archive"].includes(parsed.target) ? parsed.target : "web",
    };
  } catch {
    return NextResponse.json({ error: "Invalid optimize configuration." }, { status: 400 });
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
  const filename = `${baseName}-optimized.pdf`;

  let result;
  try {
    result = await runOptimize(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't optimize this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "optimize", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.size,
    originalSize: result.originalSize,
    pages: result.pages,
    target: config.target,
    plan,
    loggedIn: !!user,
  });
}

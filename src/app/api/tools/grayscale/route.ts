import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runGrayscale, type GrayscaleConfig } from "@/lib/tools/handlers/grayscale-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

// Dedicated route (bypasses the generic /api/tools/[tool] dispatcher). The
// generic dispatcher's existing "grayscale" tool (raster-tools.ts, plain
// grayscale only) is left untouched; this path takes priority for this
// exact URL and adds the black&white/sepia modes plus extra options.
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

  let config: GrayscaleConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      mode: ["grayscale", "blackwhite", "sepia"].includes(parsed.mode) ? parsed.mode : "grayscale",
      keepTextBlack: !!parsed.keepTextBlack,
      preserveImageQuality: !!parsed.preserveImageQuality,
      optimizeForPrint: !!parsed.optimizeForPrint,
    };
  } catch {
    return NextResponse.json({ error: "Invalid grayscale configuration." }, { status: 400 });
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
  const filename = `${baseName}-${config.mode}.pdf`;

  let result;
  try {
    result = await runGrayscale(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't convert this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "grayscale", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.size,
    originalSize: result.originalSize,
    pages: result.pages,
    imagesConverted: result.imagesConverted,
    plan,
    loggedIn: !!user,
  });
}

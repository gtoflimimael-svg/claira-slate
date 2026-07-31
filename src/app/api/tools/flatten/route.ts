import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runFlatten, type FlattenConfig } from "@/lib/tools/handlers/flatten-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

// Dedicated route (bypasses the generic /api/tools/[tool] dispatcher). The
// generic dispatcher's existing "flatten" tool (pdf-lib-tools.ts, form
// fields only) is left untouched; this path takes priority for this exact
// URL and adds annotation/layer flattening on top.
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

  let config: FlattenConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      flattenForms: !!parsed.flattenForms,
      flattenAnnotations: !!parsed.flattenAnnotations,
      flattenLayers: !!parsed.flattenLayers,
      removeHiddenLayers: !!parsed.removeHiddenLayers,
    };
  } catch {
    return NextResponse.json({ error: "Invalid flatten configuration." }, { status: 400 });
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
  const filename = `${baseName}-flattened.pdf`;

  let result;
  try {
    result = await runFlatten(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't flatten this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "flatten", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.size,
    originalSize: result.originalSize,
    pages: result.pages,
    fieldsFlattened: result.fieldsFlattened,
    annotationsFlattened: result.annotationsFlattened,
    plan,
    loggedIn: !!user,
  });
}

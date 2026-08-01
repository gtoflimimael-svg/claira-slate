import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runPdfToPpt, type PptConfig } from "@/lib/tools/handlers/ppt-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

// Dedicated route — supersedes the generic dispatcher's "pdf-to-ppt" entry,
// which was a coming-soon stub (see STUB_MESSAGE in dispatch.ts); this is a
// genuinely new implementation.
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

  let config: PptConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      layout: parsed.layout === "standard" ? "standard" : "widescreen",
      includeImages: !!parsed.includeImages,
      includeTables: !!parsed.includeTables,
      addSlideNumbers: !!parsed.addSlideNumbers,
    };
  } catch {
    return NextResponse.json({ error: "Invalid conversion configuration." }, { status: 400 });
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
  const filename = `${baseName}.pptx`;

  let result;
  try {
    result = await runPdfToPpt(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't convert this PDF to PowerPoint." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  if (user) await logToolUsage(user.id, "pdf-to-ppt", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.slidesCreated,
    slidesCreated: result.slidesCreated,
    imagesEmbedded: result.imagesEmbedded,
    plan,
    loggedIn: !!user,
  });
}

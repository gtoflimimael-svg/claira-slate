import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runPptToPdf, type PptToPdfConfig } from "@/lib/tools/handlers/ppt-to-pdf-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const LAYOUTS = ["single", "handout-2", "handout-4", "handout-6", "notes"];

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

  let config: PptToPdfConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      layout: LAYOUTS.includes(parsed.layout) ? parsed.layout : "single",
      includeHidden: !!parsed.includeHidden,
      addSlideNumbers: !!parsed.addSlideNumbers,
      includeSpeakerNotesFooter: !!parsed.includeSpeakerNotesFooter,
      quality: parsed.quality === "high" ? "high" : "standard",
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
  const baseName = file.name.replace(/\.pptx?$/i, "") || "presentation";
  const filename = `${baseName}.pdf`;

  let result;
  try {
    result = await runPptToPdf(buffer, file.name, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't convert this presentation to PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "ppt-to-pdf", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesCreated,
    pagesCreated: result.pagesCreated,
    slideCount: result.slideCount,
    plan,
    loggedIn: !!user,
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runImagesToPdf, type ImagesToPdfConfig } from "@/lib/tools/handlers/images-to-pdf-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const MAX_IMAGES = 20;

function sanitizeOutputName(name: string): string {
  const trimmed = (name || "combined-images").replace(/\.pdf$/i, "").replace(/[/\\?%*:|"<>]/g, "-").trim();
  return `${trimmed || "combined-images"}.pdf`;
}

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
  if (fileEntries.length > MAX_IMAGES) {
    return NextResponse.json({ error: `You can combine at most ${MAX_IMAGES} images at a time.` }, { status: 400 });
  }

  let config: ImagesToPdfConfig;
  let outputName: string;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      pageSize: ["fit", "a4-portrait", "a4-landscape", "letter", "match"].includes(parsed.pageSize) ? parsed.pageSize : "fit",
      margin: ["none", "small", "medium", "large"].includes(parsed.margin) ? parsed.margin : "small",
      imagesPerPage: parsed.imagesPerPage === 4 ? 4 : 1,
      addPageNumbers: !!parsed.addPageNumbers,
      addCaptions: !!parsed.addCaptions,
    };
    outputName = sanitizeOutputName(typeof parsed.outputName === "string" ? parsed.outputName : "combined-images");
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

  for (const file of fileEntries) {
    const sizeCheck = checkFileSize({ size: file.size }, plan);
    if (!sizeCheck.allowed) {
      return NextResponse.json(
        { error: `File too large for your plan (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).` },
        { status: 413 }
      );
    }
  }

  const files = await Promise.all(fileEntries.map(async (f) => Buffer.from(await f.arrayBuffer())));
  const filenames = fileEntries.map((f) => f.name);

  let result;
  try {
    result = await runImagesToPdf(files, filenames, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't combine these images into a PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${outputName}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "jpg-to-pdf", outputName, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, outputName, 3600);

  return NextResponse.json({
    downloadUrl,
    filename: outputName,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesCreated,
    pagesCreated: result.pagesCreated,
    imagesCombined: fileEntries.length,
    plan,
    loggedIn: !!user,
  });
}

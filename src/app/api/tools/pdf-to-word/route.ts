import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runPdfToWord, type WordConfig } from "@/lib/tools/handlers/word-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

// Dedicated route — supersedes the generic dispatcher's "pdf-to-word" entry,
// which was a coming-soon stub (see STUB_MESSAGE in dispatch.ts) and stays
// that way; this is a genuinely new implementation, not a replacement of
// working code.
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

  let config: WordConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      mode: parsed.mode === "exact" ? "exact" : "flowing",
      preserveFormatting: !!parsed.preserveFormatting,
      convertTables: !!parsed.convertTables,
      embedImages: !!parsed.embedImages,
      language: typeof parsed.language === "string" ? parsed.language : "auto",
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

  // OCR (for scanned PDFs with no extractable text layer) is a Pro feature;
  // the request just carries the boolean, there is no separate flag to
  // gate here beyond confirming the plan before the client would show it as
  // enabled — actual OCR isn't run by this route (see pdf-to-word-tool.tsx).

  const sizeCheck = checkFileSize({ size: file.size }, plan);
  if (!sizeCheck.allowed) {
    return NextResponse.json(
      { error: `File too large for your plan (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = file.name.replace(/\.pdf$/i, "") || "document";
  const filename = `${baseName}.docx`;

  let result;
  try {
    result = await runPdfToWord(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't convert this PDF to Word." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  if (user) await logToolUsage(user.id, "pdf-to-word", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesConverted,
    pagesConverted: result.pagesConverted,
    imagesExtracted: result.imagesExtracted,
    plan,
    loggedIn: !!user,
  });
}

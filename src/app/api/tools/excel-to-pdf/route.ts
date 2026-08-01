import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runExcelToPdf, type ExcelToPdfConfig } from "@/lib/tools/handlers/excel-to-pdf-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

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

  let config: ExcelToPdfConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      orientation: ["portrait", "landscape", "auto"].includes(parsed.orientation) ? parsed.orientation : "portrait",
      fitToPage: !!parsed.fitToPage,
      includeGridlines: !!parsed.includeGridlines,
      includeSheetNames: !!parsed.includeSheetNames,
      allSheets: !!parsed.allSheets,
      printAreaOnly: !!parsed.printAreaOnly,
      paperSize: ["a4", "letter", "a3", "legal"].includes(parsed.paperSize) ? parsed.paperSize : "a4",
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
  const baseName = file.name.replace(/\.xlsx?$/i, "") || "spreadsheet";
  const filename = `${baseName}.pdf`;

  let result;
  try {
    result = await runExcelToPdf(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't convert this spreadsheet to PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "excel-to-pdf", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesCreated,
    pagesCreated: result.pagesCreated,
    sheetsConverted: result.sheetsConverted,
    plan,
    loggedIn: !!user,
  });
}

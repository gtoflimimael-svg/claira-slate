import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runHtmlToPdf, type HtmlToPdfConfig } from "@/lib/tools/handlers/html-to-pdf-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const MAX_HTML_LENGTH = 2_000_000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let parsed: Record<string, unknown>;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const type = parsed.type === "url" ? "url" : parsed.type === "html" ? "html" : null;
  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  if (!type || !content) {
    return NextResponse.json({ error: "Missing 'type' or 'content'." }, { status: 400 });
  }
  if (type === "html" && content.length > MAX_HTML_LENGTH) {
    return NextResponse.json({ error: "That HTML is too large to convert." }, { status: 413 });
  }
  if (type === "url" && content.length > 2048) {
    return NextResponse.json({ error: "That URL is too long." }, { status: 413 });
  }

  const config: HtmlToPdfConfig = {
    type,
    content,
    pageSize: ["a4-portrait", "a4-landscape", "letter-portrait", "match-content"].includes(parsed.pageSize as string)
      ? (parsed.pageSize as HtmlToPdfConfig["pageSize"])
      : "a4-portrait",
    includeBackground: parsed.includeBackground !== false,
    waitTime: parsed.waitForLoad ? 3000 : 0,
    margin: ["none", "minimal", "standard", "wide"].includes(parsed.margin as string) ? (parsed.margin as HtmlToPdfConfig["margin"]) : "standard",
    removeHeaderFooter: !!parsed.removeHeaderFooter,
    addUrlFooter: !!parsed.addUrlFooter,
  };

  let plan: "free" | "pro" | "business" = "free";
  if (user) {
    const quota = await enforceTaskQuota(user.id);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
    }
    plan = quota.plan;
  }

  const filename = "converted.pdf";
  let result;
  try {
    result = await runHtmlToPdf(config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't convert that page to PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "html-to-pdf", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesCreated,
    pagesCreated: result.pagesCreated,
    plan,
    loggedIn: !!user,
  });
}

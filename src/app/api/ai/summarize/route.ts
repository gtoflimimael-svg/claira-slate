import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { resolveAIQuota, applyAnonQuotaCookie, logAIUsage } from "@/lib/ai/quota-check";
import { extractTextFromPDF } from "@/lib/ai/extract-text";
import { generateWithGemini } from "@/lib/ai/gemini";

// Keep the prompt within a safe token budget for very large documents.
const MAX_CHARS = 40_000;

function parseBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[\s*\-•\d.)]+/, "").trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' in form data." }, { status: 400 });
  }

  const quota = await resolveAIQuota(request, user?.id ?? null);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
  }

  const sizeCheck = checkFileSize({ size: file.size }, quota.plan);
  if (!sizeCheck.allowed) {
    return NextResponse.json(
      { error: `File too large for your plan (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractTextFromPDF(buffer);

  if (extracted.isScanned) {
    return NextResponse.json(
      { error: "No extractable text found — this looks like a scanned PDF. Try the OCR tool first." },
      { status: 422 }
    );
  }

  const prompt = `Summarize this document in 4-6 bullet points. Be concise and factual. Include page references where possible.\nDocument: ${extracted.text.slice(0, MAX_CHARS)}`;

  const result = await generateWithGemini(prompt);
  if (quota.userId) await logAIUsage(quota.userId, "summarize", result.tokensUsed);

  const response = NextResponse.json({
    summary: parseBullets(result.text),
    pages: extracted.pages,
    plan: quota.plan,
    loggedIn: !!quota.userId,
    tokensUsed: result.tokensUsed,
  });
  if (quota.anonState) applyAnonQuotaCookie(response, quota.anonState);
  return response;
}

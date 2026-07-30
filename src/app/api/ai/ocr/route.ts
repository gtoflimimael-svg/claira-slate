import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceAIQuota, logAIUsage } from "@/lib/ai/quota-check";
import { generateWithGemini } from "@/lib/ai/gemini";
import { runOcrOnPdf, generateSearchablePdf } from "@/lib/ai/ocr";

const MAX_CHARS = 40_000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' in form data." }, { status: 400 });
  }

  const quota = await enforceAIQuota(user.id);
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
  const { pages, fullText } = await runOcrOnPdf(buffer);

  const prompt =
    "Clean up this OCR-extracted text. Fix obvious errors, normalize spacing, preserve document structure.\n" +
    `Text: ${fullText.slice(0, MAX_CHARS)}`;
  const cleaned = await generateWithGemini(prompt);
  await logAIUsage(user.id, "ocr", cleaned.tokensUsed);

  const pdfBytes = await generateSearchablePdf(pages);

  return NextResponse.json({
    text: cleaned.text,
    pages: pages.length,
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    plan: quota.plan,
    tokensUsed: cleaned.tokensUsed,
  });
}

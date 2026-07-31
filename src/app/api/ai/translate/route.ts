import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { resolveAIQuota, applyAnonQuotaCookie, logAIUsage } from "@/lib/ai/quota-check";
import { extractTextFromPDF } from "@/lib/ai/extract-text";
import { generateWithGemini } from "@/lib/ai/gemini";
import { generateWithClaude } from "@/lib/ai/claude";
import { pickProvider } from "@/lib/ai/model-router";
import { generateTextPdf } from "@/lib/ai/generate-text-pdf";

const MAX_CHARS = 40_000;

function buildSystemPrompt(targetLanguage: string) {
  return (
    `You are a professional translator. Translate the following document text to ${targetLanguage}. ` +
    "Preserve the original formatting, structure, and paragraph breaks. Do not add explanations.\n\n" +
    "Respond in exactly this format:\n" +
    "ORIGINAL_LANGUAGE: <detected source language>\n" +
    "TRANSLATION:\n<translated text>"
  );
}

function parseResponse(text: string): { translatedText: string; originalLanguage: string } {
  const langMatch = text.match(/ORIGINAL_LANGUAGE:\s*(.+)/i);
  const translationMatch = text.match(/TRANSLATION:\s*\n?([\s\S]*)/i);

  return {
    originalLanguage: langMatch?.[1]?.trim() ?? "Unknown",
    translatedText: (translationMatch?.[1] ?? text).trim(),
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const file = formData.get("file");
  const targetLanguage = formData.get("targetLanguage");

  if (!(file instanceof File) || typeof targetLanguage !== "string" || !targetLanguage) {
    return NextResponse.json({ error: "Missing 'file' or 'targetLanguage' in form data." }, { status: 400 });
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

  const provider = pickProvider("translate", quota.plan);
  const system = buildSystemPrompt(targetLanguage);
  const documentText = extracted.text.slice(0, MAX_CHARS);

  const result =
    provider === "claude"
      ? await generateWithClaude(system, documentText, 8192)
      : await generateWithGemini(`${system}\n\n${documentText}`);

  if (quota.userId) await logAIUsage(quota.userId, "translate", result.tokensUsed);

  const { translatedText, originalLanguage } = parseResponse(result.text);

  let pdfBase64: string | null = null;
  try {
    const pdfBytes = await generateTextPdf(translatedText);
    pdfBase64 = Buffer.from(pdfBytes).toString("base64");
  } catch {
    // Standard fonts only cover Latin script (WinAnsi encoding) — for
    // non-Latin targets (CJK, Arabic, Cyrillic, Devanagari, etc.) fall back
    // to returning the translated text without a PDF.
  }

  const response = NextResponse.json({
    translatedText,
    originalLanguage,
    pdfBase64,
    plan: quota.plan,
    loggedIn: !!quota.userId,
    tokensUsed: result.tokensUsed,
  });
  if (quota.anonState) applyAnonQuotaCookie(response, quota.anonState);
  return response;
}

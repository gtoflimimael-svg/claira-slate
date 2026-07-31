import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAIQuota, applyAnonQuotaCookie, logAIUsage } from "@/lib/ai/quota-check";
import { extractTextFromPDF } from "@/lib/ai/extract-text";
import { generateWithClaude } from "@/lib/ai/claude";

const LEVELS = ["extreme", "recommended", "less"] as const;
type Level = (typeof LEVELS)[number];

// Deterministic classification from real, computed signals (extractable
// text characters per KB of file size) — a PDF that's mostly vector text
// packs far more characters per KB than one dominated by embedded images or
// scans. This drives the actual level suggestion; Claude Haiku is only used
// to phrase the reasoning and has final say within the 3 valid levels, not
// to "look at" the PDF itself (it never sees the file, only these stats) —
// so the reasoning is asked to stay grounded in the aggregate stats rather
// than invent specifics (like which page number has an image) it can't know.
function classify(charsPerKB: number): { classification: string; suggestedLevel: Level } {
  if (charsPerKB > 30) return { classification: "text-heavy", suggestedLevel: "extreme" };
  if (charsPerKB < 3) return { classification: "image-heavy", suggestedLevel: "less" };
  return { classification: "mixed", suggestedLevel: "recommended" };
}

const SYSTEM_PROMPT = `You are a PDF compression advisor. You will be given aggregate statistics about one or more PDF files (never the files themselves): total size, total extractable text characters, characters-per-KB density, and a deterministic classification (text-heavy / image-heavy / mixed) with its suggested compression level. Confirm or adjust the level and write a short, honest reasoning sentence grounded only in the given stats — never invent specifics you weren't given (e.g. don't claim to have seen particular pages or images).

Respond with ONLY a JSON object of the exact shape {"level": "extreme"|"recommended"|"less", "reasoning": "<one or two sentences>"}. No markdown, no other text.`;

function parseSuggestion(raw: string): { level: Level; reasoning: string } | null {
  let parsed: unknown;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as { level?: unknown; reasoning?: unknown };
  if (typeof obj.reasoning !== "string" || typeof obj.level !== "string") return null;
  if (!LEVELS.includes(obj.level as Level)) return null;
  return { level: obj.level as Level, reasoning: obj.reasoning };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const fileEntries = formData.getAll("file").filter((f): f is File => f instanceof File);
  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "Missing 'file' in form data." }, { status: 400 });
  }

  const quota = await resolveAIQuota(request, user?.id ?? null);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
  }

  let totalBytes = 0;
  let totalChars = 0;
  for (const file of fileEntries) {
    const buffer = Buffer.from(await file.arrayBuffer());
    totalBytes += buffer.byteLength;
    try {
      const extracted = await extractTextFromPDF(buffer);
      totalChars += extracted.text.length;
    } catch {
      // Treat an unparseable file as contributing no extractable text.
    }
  }

  const charsPerKB = totalBytes > 0 ? totalChars / (totalBytes / 1024) : 0;
  const { classification, suggestedLevel } = classify(charsPerKB);

  const userMessage = `Files: ${fileEntries.length}\nTotal size: ${(totalBytes / 1024).toFixed(0)} KB\nExtractable text characters: ${totalChars}\nDensity: ${charsPerKB.toFixed(1)} chars/KB\nClassification: ${classification}\nSuggested level: ${suggestedLevel}`;

  const result = await generateWithClaude(SYSTEM_PROMPT, userMessage, 512);
  const suggestion = parseSuggestion(result.text) ?? { level: suggestedLevel, reasoning: `Your files are ${classification} (${charsPerKB.toFixed(0)} text characters per KB), so ${suggestedLevel} compression is a good fit.` };

  if (quota.userId) await logAIUsage(quota.userId, "compress-suggest", result.tokensUsed);

  const response = NextResponse.json({
    level: suggestion.level,
    reasoning: suggestion.reasoning,
    plan: quota.plan,
    loggedIn: !!quota.userId,
  });
  if (quota.anonState) applyAnonQuotaCookie(response, quota.anonState);
  return response;
}

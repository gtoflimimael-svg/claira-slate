import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAIQuota, applyAnonQuotaCookie, logAIUsage } from "@/lib/ai/quota-check";
import { generateWithClaude } from "@/lib/ai/claude";

interface SuggestPage {
  pageNumber: number; // 1-indexed
  snippet: string;
}

const MAX_PAGES = 200;
const SNIPPET_CHARS = 300;

const SYSTEM_PROMPT = `You are a document page-selection assistant. You will be given a natural-language request and a list of PDF pages (each with a 1-indexed page number and a short text snippet). Return only the page numbers that match the request.

Respond with ONLY a JSON object of the exact shape {"pages": [<pageNumber>, ...], "reasoning": "<one or two sentences>"} — "pages" must be a subset of the given page numbers, in ascending order. If nothing matches, return an empty array with reasoning explaining why. No markdown, no other text.`;

function parseSuggestion(raw: string, validPages: Set<number>): { pages: number[]; reasoning: string } | null {
  let parsed: unknown;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as { pages?: unknown; reasoning?: unknown };
  if (!Array.isArray(obj.pages) || typeof obj.reasoning !== "string") return null;
  if (!obj.pages.every((p): p is number => typeof p === "number" && Number.isInteger(p))) return null;

  // Defend against a malformed/hallucinated response: every returned page
  // number must be one of the pages we actually sent, no duplicates.
  const seen = new Set<number>();
  for (const p of obj.pages) {
    if (!validPages.has(p) || seen.has(p)) return null;
    seen.add(p);
  }

  return { pages: [...obj.pages].sort((a, b) => a - b), reasoning: obj.reasoning };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = (await request.json().catch(() => null)) as { query?: string; pages?: SuggestPage[] } | null;
  const query = body?.query?.trim();
  const pages = body?.pages;
  if (!query || !Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: "Missing 'query' or 'pages'." }, { status: 400 });
  }
  if (pages.length > MAX_PAGES) {
    return NextResponse.json({ error: `AI Extract supports up to ${MAX_PAGES} pages at once.` }, { status: 400 });
  }

  const quota = await resolveAIQuota(request, user?.id ?? null);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
  }

  const validPages = new Set(pages.map((p) => p.pageNumber));
  const listing = pages
    .map((p) => `- page ${p.pageNumber}: ${(p.snippet || "(no extractable text)").slice(0, SNIPPET_CHARS)}`)
    .join("\n");
  const userMessage = `Request: "${query}"\n\nPages:\n${listing}`;

  const result = await generateWithClaude(SYSTEM_PROMPT, userMessage, 2048);
  const suggestion = parseSuggestion(result.text, validPages);

  if (!suggestion) {
    return NextResponse.json(
      { error: "AI couldn't match pages to that request. Try rephrasing or select pages manually." },
      { status: 422 }
    );
  }

  if (quota.userId) await logAIUsage(quota.userId, "extract-suggest", result.tokensUsed);

  const response = NextResponse.json({
    pages: suggestion.pages,
    reasoning: suggestion.reasoning,
    plan: quota.plan,
    loggedIn: !!quota.userId,
  });
  if (quota.anonState) applyAnonQuotaCookie(response, quota.anonState);
  return response;
}

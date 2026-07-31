import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAIQuota, applyAnonQuotaCookie, logAIUsage } from "@/lib/ai/quota-check";
import { generateWithClaude } from "@/lib/ai/claude";

interface SuggestPage {
  id: string;
  label: string; // e.g. "A · p.3" — which source PDF and original page number
  snippet: string; // short client-extracted text for that page
}

const MAX_PAGES = 200;
const SNIPPET_CHARS = 300;

const SYSTEM_PROMPT = `You are a document-reordering assistant. You will be given a list of PDF pages (each with an id, a source/page label, and a short text snippet). Analyze these pages and suggest the optimal reading order. Consider:
- Logical flow and narrative
- Numbered sections/chapters
- Date ordering if applicable
- Topic grouping

Respond with ONLY a JSON object of the exact shape {"order": ["<id>", ...], "reasoning": "<one or two sentences>"} — "order" must contain every given page id exactly once, in your suggested order. No markdown, no other text.`;

function parseSuggestion(raw: string, validIds: Set<string>): { order: string[]; reasoning: string } | null {
  let parsed: unknown;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as { order?: unknown; reasoning?: unknown };
  if (!Array.isArray(obj.order) || typeof obj.reasoning !== "string") return null;
  if (!obj.order.every((id): id is string => typeof id === "string")) return null;

  // Defend against a malformed/partial model response: the returned id set
  // must exactly match the input set (same size, no dupes, nothing missing
  // or invented) — otherwise report an error rather than silently dropping
  // or duplicating pages in the rebuilt PDF.
  const order = obj.order;
  if (order.length !== validIds.size) return null;
  const seen = new Set<string>();
  for (const id of order) {
    if (!validIds.has(id) || seen.has(id)) return null;
    seen.add(id);
  }

  return { order, reasoning: obj.reasoning };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = (await request.json().catch(() => null)) as { pages?: SuggestPage[] } | null;
  const pages = body?.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: "Missing 'pages'." }, { status: 400 });
  }
  if (pages.length > MAX_PAGES) {
    return NextResponse.json({ error: `AI Organize supports up to ${MAX_PAGES} pages at once.` }, { status: 400 });
  }

  const quota = await resolveAIQuota(request, user?.id ?? null);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
  }

  const validIds = new Set(pages.map((p) => p.id));
  const listing = pages
    .map((p) => `- id: ${p.id} | ${p.label} | text: ${(p.snippet || "(no extractable text)").slice(0, SNIPPET_CHARS)}`)
    .join("\n");
  const userMessage = `Here are ${pages.length} pages:\n${listing}`;

  const result = await generateWithClaude(SYSTEM_PROMPT, userMessage, 4096);
  const suggestion = parseSuggestion(result.text, validIds);

  if (!suggestion) {
    return NextResponse.json(
      { error: "AI couldn't produce a valid order for these pages. Try again or organize manually." },
      { status: 422 }
    );
  }

  if (quota.userId) await logAIUsage(quota.userId, "organize-suggest", result.tokensUsed);

  const response = NextResponse.json({
    order: suggestion.order,
    reasoning: suggestion.reasoning,
    plan: quota.plan,
    loggedIn: !!quota.userId,
  });
  if (quota.anonState) applyAnonQuotaCookie(response, quota.anonState);
  return response;
}

import type { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan, checkAIUsage, type Plan } from "@/lib/quota";
import type { AIFeature } from "@/lib/ai/model-router";

export type QuotaGateResult =
  | { ok: true; plan: Plan }
  | { ok: false; status: number; error: string; limit: number; plan: Plan };

const UPGRADE_MESSAGE: Record<Plan, string> = {
  free: "Upgrade to Pro for 50 actions/month.",
  pro: "Upgrade to Business for 200 actions/month.",
  business: "Contact us if you need a higher limit.",
};

// Call before every AI action. Returns 429 with an upgrade message once the
// user's monthly AI usage hits their plan limit; otherwise the caller can go
// ahead and invoke the model, then report the spend with logAIUsage().
export async function enforceAIQuota(userId: string): Promise<QuotaGateResult> {
  const plan = await getUserPlan(userId);
  const usage = await checkAIUsage(userId, plan);

  if (!usage.allowed) {
    return {
      ok: false,
      status: 429,
      error: `You've used all ${usage.limit} AI actions this month. ${UPGRADE_MESSAGE[plan]}`,
      limit: usage.limit,
      plan,
    };
  }

  return { ok: true, plan };
}

export async function logAIUsage(userId: string, actionType: AIFeature, tokensUsed: number) {
  const supabase = await createClient();
  await supabase.from("ai_usage").insert({ user_id: userId, action_type: actionType, tokens_used: tokensUsed });
}

// --- Anonymous (no account) AI quota ---------------------------------------
//
// Signed-in users' usage is tracked authoritatively in the `ai_usage` table.
// Anonymous visitors have no user_id to key that table on, so their usage is
// tracked in a cookie instead — resettable by clearing cookies, same as the
// "or localStorage" tracking this was explicitly speced to accept. It's a
// soft monthly nudge-quality limit, not a hard revenue guarantee.

const ANON_COOKIE = "cs_ai_quota";
const ANON_LIMIT = 5;

interface AnonQuotaState {
  count: number;
  period: string;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
}

function readAnonQuota(request: NextRequest): AnonQuotaState {
  const raw = request.cookies.get(ANON_COOKIE)?.value;
  const period = currentPeriod();
  if (!raw) return { count: 0, period };
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (parsed.period !== period || typeof parsed.count !== "number") return { count: 0, period };
    return parsed;
  } catch {
    return { count: 0, period };
  }
}

export type AIQuotaGate =
  | { ok: true; plan: Plan; userId: string | null; anonState: AnonQuotaState | null }
  | { ok: false; status: number; error: string; limit: number; plan: Plan };

// Like enforceAIQuota, but works for both a signed-in user and an anonymous
// visitor. Pass the request in so the anonymous branch can read its quota
// cookie; on success for an anonymous caller, apply the returned anonState
// to the response via applyAnonQuotaCookie() once you know the call succeeded.
export async function resolveAIQuota(request: NextRequest, userId: string | null): Promise<AIQuotaGate> {
  if (userId) {
    const plan = await getUserPlan(userId);
    const usage = await checkAIUsage(userId, plan);
    if (!usage.allowed) {
      return {
        ok: false,
        status: 429,
        error: `You've used all ${usage.limit} AI actions this month. ${UPGRADE_MESSAGE[plan]}`,
        limit: usage.limit,
        plan,
      };
    }
    return { ok: true, plan, userId, anonState: null };
  }

  const state = readAnonQuota(request);
  if (state.count >= ANON_LIMIT) {
    return {
      ok: false,
      status: 429,
      error: `You've used all ${ANON_LIMIT} free AI actions this month. Create a free account for more.`,
      limit: ANON_LIMIT,
      plan: "free",
    };
  }
  return { ok: true, plan: "free", userId: null, anonState: state };
}

export function applyAnonQuotaCookie(response: NextResponse, state: AnonQuotaState) {
  const next = Buffer.from(JSON.stringify({ count: state.count + 1, period: state.period })).toString("base64");
  response.cookies.set(ANON_COOKIE, next, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 40,
  });
}

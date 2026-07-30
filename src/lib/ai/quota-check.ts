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

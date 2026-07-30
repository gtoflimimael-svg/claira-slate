import { createAdminClient } from "@/lib/supabase/admin";

export type Plan = "free" | "pro" | "business";

export interface QuotaResult {
  allowed: boolean;
  limit: number;
  used: number;
}

const MB = 1024 * 1024;

export const FILE_SIZE_LIMITS: Record<Plan, number> = {
  free: 20 * MB,
  pro: 500 * MB,
  business: 500 * MB,
};

export const DAILY_TASK_LIMITS: Record<Plan, number> = {
  free: 5,
  pro: Infinity,
  business: Infinity,
};

export const AI_USAGE_LIMITS: Record<Plan, number> = {
  free: 5,
  pro: 50,
  business: 200,
};

// Subscription rows are only created/updated by Stripe webhooks — a user
// with no row, or a canceled/inactive one, is on the free plan. `past_due`
// keeps its paid plan during Stripe's dunning retries rather than being cut
// off on the first failed payment.
export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return "free";
  if (data.status === "canceled" || data.status === "inactive") return "free";
  return data.plan as Plan;
}

export function checkFileSize(file: { size: number }, plan: Plan): QuotaResult {
  const limit = FILE_SIZE_LIMITS[plan];
  return { allowed: file.size <= limit, limit, used: file.size };
}

function startOfTodayUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function checkDailyTasks(userId: string, plan: Plan): Promise<QuotaResult> {
  const limit = DAILY_TASK_LIMITS[plan];
  if (!Number.isFinite(limit)) {
    return { allowed: true, limit, used: 0 };
  }

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfTodayUTC());

  const used = count ?? 0;
  return { allowed: used < limit, limit, used };
}

export async function checkAIUsage(userId: string, plan: Plan): Promise<QuotaResult> {
  const limit = AI_USAGE_LIMITS[plan];

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonthUTC());

  const used = count ?? 0;
  return { allowed: used < limit, limit, used };
}

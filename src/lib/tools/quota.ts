import { createClient } from "@/lib/supabase/server";
import { getUserPlan, checkDailyTasks, type Plan } from "@/lib/quota";

export type TaskQuotaResult = { ok: true; plan: Plan } | { ok: false; status: number; error: string; limit: number; plan: Plan };

export async function enforceTaskQuota(userId: string): Promise<TaskQuotaResult> {
  const plan = await getUserPlan(userId);
  const usage = await checkDailyTasks(userId, plan);
  if (!usage.allowed) {
    return {
      ok: false,
      status: 429,
      error: `You've used all ${usage.limit} tool runs today on the free plan. Upgrade to Pro for unlimited use.`,
      limit: usage.limit,
      plan,
    };
  }
  return { ok: true, plan };
}

export async function logToolUsage(userId: string, tool: string, filename: string, size: number, r2Key: string) {
  const supabase = await createClient();
  await supabase.from("files").insert({
    user_id: userId,
    filename,
    size,
    tool_used: tool,
    r2_key: r2Key,
    status: "ready",
  });
}

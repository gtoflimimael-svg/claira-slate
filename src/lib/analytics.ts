import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
    capture_pageview: false,
    person_profiles: "identified_only",
  });
  initialized = true;
}

export type Plan = "free" | "pro" | "business";

export interface AnalyticsEvents {
  tool_used: { tool_name: string; user_plan: Plan; file_size: number; success: boolean };
  ai_feature_used: { feature: string; user_plan: Plan; tokens_used: number };
  upgrade_clicked: { source: string; user_plan: Plan };
  checkout_started: { plan: string };
  checkout_completed: { plan: string; amount: number };
  signup_completed: { method: "email" | "google" };
  login_completed: { method: "email" | "google" };
  file_downloaded: { tool_name: string };
  quota_limit_reached: { feature: string; plan: Plan };
}

export function track<E extends keyof AnalyticsEvents>(event: E, properties: AnalyticsEvents[E]) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function capturePageview(url: string) {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: url });
}

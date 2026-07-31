"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { track, type Plan } from "@/lib/analytics";

export function CheckoutButton({
  plan,
  children,
  className,
  style,
  source = "direct",
  userPlan = "free",
}: {
  plan: "pro" | "business";
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  source?: string;
  userPlan?: Plan;
}) {
  const t = useTranslations("billingShared");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);
    track("upgrade_clicked", { source, user_plan: userPlan });
    track("checkout_started", { plan });

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (res.status === 401 && data.redirect) {
        router.push(data.redirect);
        return;
      }
      if (!res.ok || !data.url) {
        setError(data.error || t("checkoutError"));
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError(tc("couldntReachServer"));
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
        style={{ ...style, cursor: loading ? "default" : style?.cursor ?? "pointer", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? t("redirecting") : children}
      </button>
      {error && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--cs-bad)" }}>{error}</div>}
    </>
  );
}

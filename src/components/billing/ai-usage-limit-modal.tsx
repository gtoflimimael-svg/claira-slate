"use client";

import { useTranslations } from "next-intl";
import { CheckoutButton } from "@/components/billing/checkout-button";

export function AIUsageLimitModal({
  open,
  onClose,
  limit,
}: {
  open: boolean;
  onClose: () => void;
  /** Monthly AI action limit on the user's current plan (for the message). */
  limit: number;
}) {
  const t = useTranslations("billingShared");
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        background: "color-mix(in oklab, black 45%, transparent)",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "clamp(22px,3vw,28px)",
          border: "1px solid var(--cs-line)",
          borderRadius: 20,
          background: "var(--cs-card)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            margin: "0 auto",
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--cs-accent-soft)",
            border: "1px solid var(--cs-accent-line)",
            display: "grid",
            placeItems: "center",
            color: "var(--cs-accent)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 2.5 4 14h6.5L9.5 21.5 20 10h-7z"></path>
          </svg>
        </div>
        <div style={{ marginTop: 16, fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: "-.025em" }}>
          {t("usageLimitTitle", { limit })}
        </div>
        <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
          {t("usageLimitBody")}
        </p>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 9 }}>
          <CheckoutButton
            plan="pro"
            source="ai_usage_limit_modal"
            style={{ display: "block", width: "100%", textAlign: "center", padding: 13, border: "none", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 600 }}
          >
            {t("upgradeToProCta")} &rarr;
          </CheckoutButton>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: 12, border: "none", borderRadius: 10, background: "transparent", color: "var(--cs-text-2)", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
          >
            {t("maybeLater")}
          </button>
        </div>
      </div>
    </div>
  );
}

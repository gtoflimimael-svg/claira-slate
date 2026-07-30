"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { SIDEBAR } from "@/lib/data";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { createClient } from "@/lib/supabase/client";
import { CheckoutButton } from "@/components/billing/checkout-button";

type Plan = "free" | "pro" | "business";

const ROUTE_MAP: Record<string, string> = {
  "app-home": "/app",
  "app-history": "/app/history",
  "app-files": "/app/files",
  "app-usage": "/app/usage",
  "app-billing": "/app/billing",
  "app-settings": "/app/settings",
  "app-team": "/app/team",
};

const SIDEBAR_LABEL_KEY: Record<string, string> = {
  "app-home": "home",
  "app-history": "history",
  "app-files": "files",
  "app-usage": "aiUsage",
  "app-billing": "billing",
  "app-settings": "settings",
  "app-team": "team",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>("free");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? null);
      supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data && data.status !== "canceled" && data.status !== "inactive") {
            setPlan(data.plan as Plan);
          }
        });
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        minHeight: "100vh",
        background: "var(--cs-bg-2)",
        color: "var(--cs-text)",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <style>{`
        @media (max-width: 880px) {
          [data-app-sidebar] {
            position: static !important;
            height: auto !important;
            width: 100% !important;
            flex-direction: row !important;
            align-items: center !important;
            flex-wrap: wrap;
            gap: 8px;
            border-right: 0 !important;
            border-bottom: 1px solid var(--cs-line);
          }
        }
      `}</style>
      <aside
        data-app-sidebar
        style={{
          flex: "none",
          width: 248,
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "20px 16px",
          borderRight: "1px solid var(--cs-line)",
          background: "var(--cs-bg)",
        }}
      >
        <Link href="/" aria-label="Claira Slate" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px", lineHeight: 0, cursor: "pointer" }}>
          <svg width="30" height="30" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <path d="M62 28C42 28 26 42 26 60C26 78 42 92 62 92" fill="none" stroke="var(--cs-accent)" strokeWidth="12" strokeLinecap="round"></path>
            <path
              d="M68 28C88 28 94 38 94 47C94 56 84 60 74 60C64 60 54 64 54 73C54 82 60 92 80 92"
              fill="none"
              stroke="var(--cs-logo-s)"
              strokeWidth="12"
              strokeLinecap="round"
            ></path>
          </svg>
        </Link>

        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 3 }}>
          {SIDEBAR.map((s) => {
            const href = ROUTE_MAP[s.route];
            const on = pathname === href;
            return (
              <Link
                key={s.route}
                href={href}
                className="hover-bg"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 11px",
                  borderRadius: 8,
                  fontSize: 13.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background: on
                    ? "linear-gradient(var(--cs-accent),var(--cs-cyan)) left/3px 100% no-repeat, color-mix(in oklab, var(--cs-accent) 10%, transparent)"
                    : "transparent",
                  color: on ? "var(--cs-accent)" : "var(--cs-text-2)",
                  fontWeight: on ? 600 : 500,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                  <path d={s.d}></path>
                </svg>
                {t(SIDEBAR_LABEL_KEY[s.route])}
              </Link>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 14 }}>
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <LanguageSwitcher direction="up" />
            </div>
          </div>
          <div style={{ paddingTop: 14, borderTop: "1px solid var(--cs-line)", display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                flex: "none",
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--cs-accent-soft)",
                border: "1px solid var(--cs-accent-line)",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--cs-accent)",
              }}
            >
              {(email?.slice(0, 2) ?? "??").toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email ?? "…"}</div>
              <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                {plan === "free" ? (
                  <CheckoutButton
                    plan="pro"
                    source="app_sidebar"
                    style={{ padding: 0, border: 0, background: "none", color: "var(--cs-accent)", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600 }}
                  >
                    Upgrade to Pro &rarr;
                  </CheckoutButton>
                ) : (
                  <>
                    <span style={{ padding: "2px 7px", borderRadius: 5, background: "var(--cs-accent)", color: "#fff", fontSize: 9.5, fontWeight: 600, letterSpacing: ".04em" }}>
                      {plan === "business" ? "BUSINESS" : "PRO"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--cs-text-2)" }}>{plan === "business" ? "$12/user/mo" : "$5/mo"}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="hover-bg"
            style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", border: "none", borderRadius: 8, background: "transparent", fontSize: 13, fontWeight: 500, color: "var(--cs-text-2)", cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ flex: "none" }}>
              <path d="M15 17l5-5-5-5M20 12H9M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7"></path>
            </svg>
            {t("logout")}
          </button>
        </div>
      </aside>

      <main style={{ flex: "1 1 auto", minWidth: 0, padding: "clamp(20px,3vw,36px) clamp(20px,3vw,40px) clamp(48px,6vw,72px)" }}>{children}</main>
    </div>
  );
}

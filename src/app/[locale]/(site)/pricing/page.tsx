import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/reveal";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/quota";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { ManageSubscriptionButton } from "@/components/billing/manage-subscription-button";

export const metadata: Metadata = {
  title: "Pricing — Free, Pro $5/mo, Business $12/user — Claira Slate",
  description: "Simple pricing. No surprises. Every tool is free to try, forever. Upgrade when volume or teamwork gets in the way.",
};

const CHECK = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none", marginTop: 3 }}>
    <path d="M4 12.5l5 5L20 6.5"></path>
  </svg>
);

const TICK = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2.4" strokeLinecap="round">
    <path d="M4 12.5l5 5L20 6.5"></path>
  </svg>
);

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
  padding: "15px 20px",
  borderBottom: "1px solid var(--cs-line)",
  fontSize: 14,
};

const COMPARE_ROWS: { feature: string; free: React.ReactNode; pro: React.ReactNode; business: React.ReactNode }[] = [
  { feature: "Tools", free: "All 26", pro: "All 26", business: "All 26" },
  { feature: "AI actions", free: "2 / day", pro: "Unlimited", business: "Unlimited" },
  { feature: "Max file size", free: "25 MB", pro: "2 GB", business: "2 GB" },
  { feature: "Files per batch", free: "5", pro: "20", business: "Unlimited" },
  { feature: "File history", free: "—", pro: TICK, business: TICK },
  { feature: "SSO & audit log", free: "—", pro: "—", business: TICK },
  { feature: "Support", free: "Help centre", pro: "Email, 1 day", business: "Priority, 4 h" },
];

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const plan = user ? await getUserPlan(user.id) : "free";
  const isPaid = plan === "pro" || plan === "business";

  return (
    <>
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,8vw,104px) 24px 0" }}>
        <h1
          style={{
            margin: 0,
            maxWidth: 720,
            fontFamily: "var(--font-geist), Inter, sans-serif",
            fontWeight: 600,
            fontSize: "clamp(36px,6vw,64px)",
            lineHeight: 1.03,
            letterSpacing: "-.042em",
          }}
        >
          Simple pricing. No surprises.
        </h1>
        <p style={{ margin: "20px 0 0", maxWidth: 500, fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "var(--cs-text-2)" }}>
          Every tool is free to try, forever. Upgrade when volume or teamwork gets in the way.
        </p>

        <div style={{ marginTop: "clamp(36px,5vw,56px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(268px,100%),1fr))", gap: 14, alignItems: "start" }}>
          <Reveal variant="scale" index={0} data-lift style={{ padding: 26, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("free.name")}</div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 40, fontWeight: 600, letterSpacing: "-.04em" }}>$0</span>
              <span style={{ fontSize: 14, color: "var(--cs-text-2)" }}>{t("free.unit")}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.55, color: "var(--cs-text-2)" }}>{t("free.tagline")}</div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
              {(t.raw("free.features") as string[]).map((f) => (
                <div key={f} style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}{f}</div>
              ))}
            </div>
            <Link
              href="/signup"
              className="hover-border hover-text"
              style={{ marginTop: 26, display: "block", textAlign: "center", padding: 11, borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              {t("free.cta")}
            </Link>
          </Reveal>

          <Reveal
            variant="scale"
            index={1}
            data-lift
            data-proglow
            style={{
              padding: 26,
              borderRadius: 20,
              background: "linear-gradient(var(--cs-card),var(--cs-card)) padding-box,var(--cs-grad-135) border-box",
              border: "1.5px solid transparent",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cs-accent)" }}>{t("pro.name")}</div>
              <div style={{ padding: "4px 10px", borderRadius: 99, background: "var(--cs-grad)", color: "#fff", fontSize: 11, fontWeight: 600 }}>{t("pro.badge")}</div>
            </div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 40, fontWeight: 600, letterSpacing: "-.04em" }}>$5</span>
              <span style={{ fontSize: 14, color: "var(--cs-text-2)" }}>{t("pro.unit")}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.55, color: "var(--cs-text-2)" }}>{t("pro.tagline")}</div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
              {(t.raw("pro.features") as string[]).map((f) => (
                <div key={f} style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}{f}</div>
              ))}
            </div>
            {isPaid ? (
              <ManageSubscriptionButton
                style={{ marginTop: 26, display: "block", width: "100%", textAlign: "center", padding: 11, borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14, fontWeight: 500, border: "none" }}
              >
                {t("manageSubscription")}
              </ManageSubscriptionButton>
            ) : (
              <CheckoutButton
                plan="pro"
                source="pricing_page"
                userPlan={plan}
                style={{ marginTop: 26, display: "block", width: "100%", textAlign: "center", padding: 11, borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14, fontWeight: 500, border: "none" }}
              >
                {t("pro.cta")}
              </CheckoutButton>
            )}
          </Reveal>

          <Reveal variant="scale" index={2} data-lift style={{ padding: 26, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("business.name")}</div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 40, fontWeight: 600, letterSpacing: "-.04em" }}>$12</span>
              <span style={{ fontSize: 14, color: "var(--cs-text-2)" }}>{t("business.unit")}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.55, color: "var(--cs-text-2)" }}>{t("business.tagline")}</div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
              {(t.raw("business.features") as string[]).map((f) => (
                <div key={f} style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}{f}</div>
              ))}
            </div>
            <Link
              href="/contact"
              className="hover-border hover-text"
              style={{ marginTop: 26, display: "block", textAlign: "center", padding: 11, borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              {t("business.cta")}
            </Link>
          </Reveal>
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,7vw,88px) 24px 0" }}>
        <Reveal
          as="h2"
          style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(24px,3vw,32px)", lineHeight: 1.1, letterSpacing: "-.03em" }}
        >
          Compare the plans
        </Reveal>
        <div style={{ marginTop: 24, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", overflowX: "auto" }}>
          <div style={{ minWidth: 560 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
                padding: "14px 20px",
                borderBottom: "1px solid var(--cs-line)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: ".04em",
                textTransform: "uppercase",
                color: "var(--cs-text-2)",
              }}
            >
              <div>Feature</div>
              <div>Free</div>
              <div style={{ color: "var(--cs-accent)" }}>Pro</div>
              <div>Business</div>
            </div>
            {COMPARE_ROWS.map((r, i) => (
              <div key={r.feature} style={i === COMPARE_ROWS.length - 1 ? { ...rowStyle, borderBottom: "none" } : { ...rowStyle, alignItems: "center" }}>
                <div>{r.feature}</div>
                <div style={{ color: "var(--cs-text-2)" }}>{r.free}</div>
                <div style={{ color: "var(--cs-text-2)" }}>{r.pro}</div>
                <div style={{ color: "var(--cs-text-2)" }}>{r.business}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(48px,6vw,80px) 24px clamp(56px,7vw,96px)" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            padding: 26,
            border: "1px solid var(--cs-line)",
            borderRadius: 20,
            background: "var(--cs-bg-2)",
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: "-.025em" }}>Not sure yet?</div>
            <div style={{ marginTop: 6, fontSize: 14.5, lineHeight: 1.55, color: "var(--cs-text-2)" }}>
              Use every tool free, with no account. Upgrade only when a limit gets in your way.
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link
              href="/tools"
              className="hover-border hover-text"
              style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}
            >
              Browse tools
            </Link>
            <Link href="/contact" style={{ padding: "12px 20px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}>
              Talk to sales
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

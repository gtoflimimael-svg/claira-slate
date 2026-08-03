import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { checkAIUsage, type Plan } from "@/lib/quota";
import { ManageSubscriptionButton } from "@/components/billing/manage-subscription-button";
import { CheckoutSuccessTracker } from "@/components/billing/checkout-success-tracker";

const PLAN_PRICE: Record<Plan, string> = { free: "$0", pro: "$5", business: "$12" };

function formatDate(iso: string | null, locale: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });
}

function formatAmount(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default async function BillingPage() {
  const t = await getTranslations("dashboard.billing_");
  const locale = await getLocale();
  const PLAN_LABEL: Record<Plan, string> = { free: t("planFree"), pro: t("planPro"), business: t("planBusiness") };
  const PLAN_UNIT: Record<Plan, string> = { free: t("unitForever"), pro: t("unitMonth"), business: t("unitUserMonth") };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login?redirect=/app/billing", locale: await getLocale() });
    return;
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan: Plan = subscription && subscription.status !== "canceled" && subscription.status !== "inactive" ? (subscription.plan as Plan) : "free";
  const isPaid = plan !== "free";

  let invoices: { id: string; date: string; description: string; amount: string; url: string | null }[] = [];
  if (subscription?.stripe_customer_id) {
    const list = await getStripe().invoices.list({ customer: subscription.stripe_customer_id, limit: 12 });
    invoices = list.data.map((inv) => ({
      id: inv.id ?? inv.number ?? crypto.randomUUID(),
      date: new Date(inv.created * 1000).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }),
      description: inv.lines.data[0]?.description ?? `${PLAN_LABEL[plan]} plan`,
      amount: formatAmount(inv.amount_paid, inv.currency, locale),
      url: inv.hosted_invoice_url ?? inv.invoice_pdf ?? null,
    }));
  }

  const aiUsage = await checkAIUsage(user.id, plan);
  const nextBilling = formatDate(subscription?.current_period_end ?? null, locale);

  return (
    <div>
      <Suspense fallback={null}>
        <CheckoutSuccessTracker plan={plan} amount={plan === "pro" ? 5 : plan === "business" ? 12 : 0} />
      </Suspense>
      <h1 style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(42px,5.25vw,59.5px)", lineHeight: 1.1, letterSpacing: "-.035em" }}>{t("title")}</h1>
      <p style={{ margin: "8px 0 0", fontSize: 25.38, color: "var(--cs-text-2)" }}>{t("subtitle")}</p>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))", gap: 14, alignItems: "start" }}>
        <div style={{ padding: 24, border: "1.5px solid var(--cs-accent)", borderRadius: 20, background: "var(--cs-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 22.75, fontWeight: 600, color: "var(--cs-accent)" }}>{t("currentPlan")}</div>
            <span style={{ padding: "4px 10px", borderRadius: 99, background: "var(--cs-accent)", color: "#fff", fontSize: 19.25, fontWeight: 600 }}>{PLAN_LABEL[plan]}</span>
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 59.5, fontWeight: 600, letterSpacing: "-.04em" }}>{PLAN_PRICE[plan]}</span>
            <span style={{ fontSize: 24.5, color: "var(--cs-text-2)" }}>{PLAN_UNIT[plan]}</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 23.62, color: "var(--cs-text-2)" }}>
            {isPaid && nextBilling ? t("renews", { date: nextBilling }) + " " : isPaid ? t("renewalPending") + " " : ""}
            {plan === "free" ? t("freeLimits") : t("paidLimits")}
          </div>
          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 9 }}>
            {isPaid ? (
              <ManageSubscriptionButton style={{ padding: "10px 16px", borderRadius: 9, background: "var(--cs-accent)", color: "#fff", fontSize: 23.62, fontWeight: 500, border: "none" }}>
                {t("manageSubscription")}
              </ManageSubscriptionButton>
            ) : (
              <Link href="/pricing" style={{ padding: "10px 16px", borderRadius: 9, background: "var(--cs-accent)", color: "#fff", fontSize: 23.62, fontWeight: 500, cursor: "pointer" }}>
                {t("upgradePlan")}
              </Link>
            )}
          </div>
        </div>

        <div style={{ padding: 24, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)" }}>
          <div style={{ fontSize: 22.75, fontWeight: 600 }}>{t("aiUsageThisMonth")}</div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 49, fontWeight: 600, letterSpacing: "-.03em" }}>{aiUsage.used}</span>
            <span style={{ fontSize: 24.5, color: "var(--cs-text-2)" }}>/ {Number.isFinite(aiUsage.limit) ? aiUsage.limit : t("unlimited")} {t("actionsSuffix")}</span>
          </div>
          {Number.isFinite(aiUsage.limit) && (
            <div style={{ marginTop: 12, height: 6, borderRadius: 99, background: "var(--cs-bg-2)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (aiUsage.used / aiUsage.limit) * 100)}%`,
                  background: aiUsage.allowed ? "var(--cs-accent)" : "var(--cs-bad)",
                  borderRadius: 99,
                }}
              />
            </div>
          )}
          <div style={{ marginTop: 14, fontSize: 22.75, fontWeight: 600 }}>{t("billingDetails")}</div>
          <div style={{ marginTop: 10, fontSize: 23.62, color: "var(--cs-text-2)" }}>{user.email}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)", overflowX: "auto" }}>
        <div style={{ minWidth: 520 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.6fr .8fr .8fr",
              padding: "14px 20px",
              borderBottom: "1px solid var(--cs-line)",
              fontSize: 20.12,
              fontWeight: 600,
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--cs-text-2)",
            }}
          >
            <div>{t("colDate")}</div>
            <div>{t("colDescription")}</div>
            <div>{t("colAmount")}</div>
            <div>{t("colInvoice")}</div>
          </div>
          {invoices.length === 0 ? (
            <div style={{ padding: "20px", fontSize: 23.62, color: "var(--cs-text-2)" }}>
              {isPaid ? t("noInvoices") : t("freeNothingToBill")}
            </div>
          ) : (
            invoices.map((i) => (
              <div key={i.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr .8fr .8fr", alignItems: "center", padding: "15px 20px", borderBottom: "1px solid var(--cs-line)", fontSize: 23.62 }}>
                <div style={{ fontWeight: 500 }}>{i.date}</div>
                <div style={{ color: "var(--cs-text-2)" }}>{i.description}</div>
                <div style={{ color: "var(--cs-text-2)" }}>{i.amount}</div>
                <div>
                  {i.url ? (
                    <a href={i.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 21.88, fontWeight: 500, cursor: "pointer" }}>
                      PDF &darr;
                    </a>
                  ) : (
                    <span style={{ fontSize: 21.88, color: "var(--cs-text-2)" }}>—</span>
                  )}
                </div>
              </div>
            ))
          )}
          {isPaid && <div style={{ padding: "16px 20px", fontSize: 21.88, color: "var(--cs-text-2)" }}>{t("invoicesNote")}</div>}
        </div>
      </div>
    </div>
  );
}

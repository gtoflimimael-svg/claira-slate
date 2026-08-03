import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HeroIllustration } from "@/components/home/hero-illustration";

const HEADLINE_MARKER = "⁣";

export function Hero() {
  const t = useTranslations("hero");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const aiWord = t("ai");
  const [headlineBefore, headlineAfter] = t("headline", { ai: HEADLINE_MARKER }).split(HEADLINE_MARKER);

  return (
    <section
      id="top"
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        marginTop: -68,
        padding: "clamp(84px,6vw,108px) 24px 48px",
        background:
          "radial-gradient(58% 50% at 40% 16%, color-mix(in oklab, var(--cs-accent) 7%, transparent), transparent 70%), radial-gradient(48% 42% at 86% 6%, color-mix(in oklab, var(--cs-cyan) 7%, transparent), transparent 72%)",
      }}
    >
      <style>{`
        [data-hero-grid] {
          display: grid;
          grid-template-columns: 55% 45%;
          align-items: center;
          gap: clamp(28px,4vw,56px);
        }
        @media (max-width: 860px) {
          [data-hero-grid] {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        <div data-hero-grid>
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-geist), Inter, sans-serif",
                fontWeight: 600,
                fontSize: "clamp(57px,9vw,108px)",
                lineHeight: 1.04,
                letterSpacing: "-.042em",
                textWrap: "balance",
              }}
            >
              <span data-word style={{ animationDelay: "0s" }}>
                {headlineBefore}
                <span
                  style={{
                    background: "linear-gradient(90deg,var(--cs-accent),var(--cs-cyan),var(--cs-accent))",
                    backgroundSize: "200% 100%",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    color: "transparent",
                    animation: "csShimmer 3s linear infinite",
                  }}
                >
                  {aiWord}
                </span>
                {headlineAfter}
              </span>
            </h1>
            <p
              style={{
                margin: "24px 0 0",
                maxWidth: 520,
                fontSize: "clamp(24px,2.25vw,28.5px)",
                lineHeight: 1.6,
                color: "var(--cs-text-2)",
                animation: "csRise .5s var(--cs-ease) 1.05s both",
              }}
            >
              {t("subheadline")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 34, animation: "csRise .5s var(--cs-ease) 1.25s both" }}>
              <Link
                data-press
                data-arrow
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "13px 22px",
                  borderRadius: 10,
                  background: "var(--cs-grad)",
                  color: "#fff",
                  fontSize: 22.5,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {t("ctaPrimary")} <span data-tip style={{ fontSize: 22.5 }}>&rarr;</span>
              </Link>
              <Link
                data-press
                href="/tools"
                className="hover-border hover-text"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "13px 22px",
                  borderRadius: 10,
                  border: "1px solid var(--cs-line)",
                  color: "var(--cs-text)",
                  fontSize: 22.5,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {t("ctaSecondary")}
              </Link>
            </div>
            <div style={{ margin: "22px 0 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, fontSize: 20.25, fontWeight: 500, color: "var(--cs-text-2)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, animation: "csRise .4s var(--cs-ease) 1.45s both" }}>
                <svg data-check width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2.6" strokeLinecap="round" style={{ flex: "none" }}>
                  <path d="M4 12.5l5 5L20 6.5" style={{ animationDelay: "1.45s" }}></path>
                </svg>
                {t("proof1")}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, animation: "csRise .4s var(--cs-ease) 1.75s both" }}>
                <svg data-check width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2.6" strokeLinecap="round" style={{ flex: "none" }}>
                  <path d="M4 12.5l5 5L20 6.5" style={{ animationDelay: "1.75s" }}></path>
                </svg>
                {t("proof2")}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, animation: "csRise .4s var(--cs-ease) 2.05s both" }}>
                <svg data-check width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2.6" strokeLinecap="round" style={{ flex: "none" }}>
                  <path d="M4 12.5l5 5L20 6.5" style={{ animationDelay: "2.05s" }}></path>
                </svg>
                {t("proof3")}
              </span>
            </div>
          </div>

          <div
            data-heroart
            style={{
              position: "relative",
              height: "clamp(260px,34vw,500px)",
              maxHeight: 500,
              pointerEvents: "none",
            }}
          >
            <HeroIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}

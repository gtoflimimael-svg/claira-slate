import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";

export const metadata = {
  title: "About — Claira Slate",
  description: "Claira Slate started in 2024 as a weekend fix for a broken merge tool. Today it processes millions of documents a month.",
};

const STAT_KEYS = ["statDocuments", "statRetention", "statPeople", "statAds"] as const;
const STAT_CONTENT: ReactNode[] = [
  (
    <>
      <CountUp value={48} />
      M+
    </>
  ),
  "1 h",
  "19",
  "0",
];

const VALUE_KEYS = ["value1", "value2", "value3"] as const;
const TRUST_KEYS = ["trust1", "trust2", "trust3"] as const;

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <div>
      <section style={{ padding: "clamp(56px,8vw,104px) 24px 0" }}>
        <h1
          style={{
            margin: 0,
            maxWidth: 800,
            fontFamily: "var(--font-geist), Inter, sans-serif",
            fontWeight: 600,
            fontSize: "clamp(36px,6vw,64px)",
            lineHeight: 1.03,
            letterSpacing: "-.042em",
          }}
        >
          {t("heroTitle")}
        </h1>
        <p style={{ margin: "22px 0 0", maxWidth: 560, fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.65, color: "var(--cs-text-2)" }}>
          {t("heroSubhead")}
        </p>
        <div
          style={{
            marginTop: "clamp(40px,5vw,64px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(200px,100%),1fr))",
            gap: 0,
            borderTop: "1.5px solid var(--cs-text)",
          }}
        >
          {STAT_KEYS.map((key, i) => (
            <div key={key} style={{ padding: i === 0 ? "24px 24px 24px 0" : "24px", borderLeft: i === 0 ? "none" : "1px solid var(--cs-line)" }}>
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: "clamp(28px,3.4vw,38px)", fontWeight: 600, letterSpacing: "-.04em", color: "var(--cs-accent)" }}>
                {STAT_CONTENT[i]}
              </div>
              <div style={{ marginTop: 6, fontSize: 13.5, color: "var(--cs-text-2)" }}>{t(key)}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "clamp(56px,7vw,96px) 24px 0" }}>
        <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(26px,3.4vw,40px)", lineHeight: 1.08, letterSpacing: "-.035em" }}>
          {t("valuesTitle")}
        </Reveal>
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(268px,100%),1fr))", gap: 14 }}>
          {VALUE_KEYS.map((key, i) => (
            <Reveal
              key={key}
              variant="scale"
              index={i}
              data-lift
              style={{ padding: 26, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}
            >
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: "-.02em" }}>{t(`${key}Title`)}</div>
              <div style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.6, color: "var(--cs-text-2)" }}>{t(`${key}Body`)}</div>
            </Reveal>
          ))}
        </div>
      </section>

      <section style={{ padding: "clamp(56px,7vw,96px) 24px 0" }}>
        <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(26px,3.4vw,40px)", lineHeight: 1.08, letterSpacing: "-.035em" }}>
          {t("trustTitle")}
        </Reveal>
        <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(240px,100%),1fr))", gap: 14 }}>
          {TRUST_KEYS.map((key) => (
            <div key={key} style={{ padding: 22, border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-card)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--cs-text-2)" }}>{t(`${key}Title`)}</div>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--cs-text-2)" }}>{t(`${key}Body`)}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link
            href="/contact"
            className="hover-bg"
            style={{ padding: "12px 20px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}
          >
            {t("requestDpa")}
          </Link>
          <Link
            href="/blog"
            className="hover-text"
            style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}
          >
            {t("readEngineeringNotes")}
          </Link>
        </div>
      </section>

      <section style={{ padding: "clamp(56px,7vw,96px) 24px clamp(56px,7vw,96px)" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            padding: "clamp(24px,3vw,32px)",
            border: "1px solid var(--cs-accent-line)",
            borderRadius: 20,
            background: "var(--cs-accent-soft)",
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: "-.025em" }}>
              {t("hiringTitle")}
            </div>
            <div style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
              {t("hiringBody")}
            </div>
          </div>
          <Link
            href="/contact"
            className="hover-bg"
            style={{ padding: "12px 20px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {t("hiringCta")} &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}

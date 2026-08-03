"use client";

import { useTranslations } from "next-intl";
import { Reveal } from "@/components/reveal";
import { useDocsCounter } from "@/lib/use-docs-counter";

const TESTIMONIALS = [
  { key: "testimonial1", initials: "MR", name: "Maya Rendel" },
  { key: "testimonial2", initials: "TB", name: "Tomas Beck" },
  { key: "testimonial3", initials: "PA", name: "Priya Anand" },
];

const BADGES = [
  { icon: <path d="M12 3l8 3v6c0 5-3.5 7.7-8 9-4.5-1.3-8-4-8-9V6z"></path>, key: "badgeGdpr" },
  { icon: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2"></path>, key: "badgeDeleted" },
  { icon: <path d="M4 12.5l5 5L20 6.5"></path>, key: "badgeNoAccount" },
];

export function SocialProof() {
  const t = useTranslations("home.socialProof");
  const docs = useDocsCounter();
  return (
    <section id="trust" style={{ borderTop: "1px solid var(--cs-line)", background: "var(--cs-bg)" }}>
      <div style={{ padding: "clamp(64px,8vw,104px) 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 28 }}>
          <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(45px,6.6vw,72px)", lineHeight: 1.06, letterSpacing: "-.035em" }}>
            {t("title")}
          </Reveal>
          <div>
            <div
              style={{
                fontFamily: "var(--font-geist), Inter, sans-serif",
                fontSize: "clamp(42px,5.1vw,60px)",
                fontWeight: 600,
                letterSpacing: "-.04em",
                fontVariantNumeric: "tabular-nums",
                background: "var(--cs-grad)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {docs}
            </div>
            <div style={{ marginTop: 4, fontSize: 20.25, fontWeight: 500, color: "var(--cs-text-2)" }}>{t("docsCaption")}</div>
          </div>
        </div>

        <div style={{ marginTop: "clamp(36px,5vw,52px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(272px,1fr))", gap: 14 }}>
          {TESTIMONIALS.map((item, i) => (
            <Reveal key={item.key} index={i} data-lift style={{ padding: 26, border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-card)" }}>
              <p style={{ margin: 0, fontSize: 23.25, lineHeight: 1.6, letterSpacing: "-.012em" }}>&ldquo;{t(`${item.key}Quote`)}&rdquo;</p>
              <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", display: "grid", placeItems: "center", fontSize: 18.75, fontWeight: 600, color: "var(--cs-accent)" }}>
                  {item.initials}
                </div>
                <div>
                  <div style={{ fontSize: 20.25, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 18.75, color: "var(--cs-text-2)" }}>{t(`${item.key}Role`)}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div style={{ marginTop: 34, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {BADGES.map((b) => (
            <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 15px", border: "1px solid var(--cs-line)", borderRadius: 99, fontSize: 19.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2" strokeLinecap="round">
                {b.icon}
              </svg>
              {t(b.key)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

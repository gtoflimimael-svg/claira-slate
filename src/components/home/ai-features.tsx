import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/reveal";

const FEATURES = [
  { key: "summarize", icon: <path d="M4 6h16M4 11h16M4 16h9"></path> },
  { key: "chat", icon: <path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"></path> },
  { key: "translate", icon: <path d="M4 6h9M8.5 6c0 5-2 8-5.5 10M6 11c1.5 3 4 4.5 7 5M13 20l4-10 4 10M14.6 17h4.8"></path> },
  { key: "ocr", icon: <path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 12h8"></path> },
];

export function AiFeatures() {
  const t = useTranslations("ai");
  const th = useTranslations("home.aiTeaser");

  return (
    <section id="ai" style={{ position: "relative", background: "var(--cs-ink)", color: "#fff", overflow: "hidden" }}>
      <div data-stars></div>
      <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto", padding: "clamp(72px,9vw,120px) 24px" }}>
        <Reveal
          as="span"
          variant="fade"
          data-spinborder
          style={{ display: "inline-block", padding: "6px 13px", borderRadius: 99, background: "var(--cs-accent)", color: "#fff", fontSize: 12, fontWeight: 600, letterSpacing: ".01em" }}
        >
          {th("badge")}
        </Reveal>
        <Reveal as="h2" style={{ margin: "22px 0 0", maxWidth: 760, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(32px,5vw,56px)", lineHeight: 1.04, letterSpacing: "-.038em", color: "#fff" }}>
          {th("headline")}
        </Reveal>
        <p style={{ margin: "18px 0 0", maxWidth: 520, fontSize: 17, lineHeight: 1.6, color: "rgba(255,255,255,.62)" }}>
          {th("subhead")}
        </p>

        <div style={{ marginTop: "clamp(40px,5vw,64px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(238px,1fr))", gap: 14 }}>
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.key}
              variant="fade"
              index={i}
              data-spring
              data-gradient-top
              className="hover-border-white"
              style={{ padding: 24, border: "1px solid var(--cs-ink-line)", borderRadius: "var(--cs-r)", background: "var(--cs-ink-2)" }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--cs-grad-135)", display: "grid", placeItems: "center", color: "#fff" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  {f.icon}
                </svg>
              </div>
              <div style={{ marginTop: 18, fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: "-.02em" }}>{t(`${f.key}.name`)}</div>
              <div style={{ marginTop: 7, fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,.58)" }}>{t(`${f.key}.desc`)}</div>
            </Reveal>
          ))}
        </div>
        <div style={{ marginTop: 38 }}>
          <Link
            data-press
            data-arrow
            href="/ai"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 10, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 500, cursor: "pointer" }}
          >
            {th("cta")} <span data-tip>&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

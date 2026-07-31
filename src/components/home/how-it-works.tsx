import { useTranslations } from "next-intl";
import { Reveal } from "@/components/reveal";

const STEPS: { icon: React.ReactNode; num: string; titleKey: string; descKey: string; variant: "left" | undefined | "right" }[] = [
  {
    icon: (
      <>
        <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.24"></path>
        <path d="M12 21v-8"></path>
        <path d="M8 17l4-4 4 4"></path>
      </>
    ),
    num: "01",
    titleKey: "step1Title",
    descKey: "step1Desc",
    variant: "left",
  },
  {
    icon: <path d="M13.5 2.5 4 14h6.5L9.5 21.5 20 10h-7z"></path>,
    num: "02",
    titleKey: "step2Title",
    descKey: "step2Desc",
    variant: undefined,
  },
  {
    icon: (
      <>
        <path d="M12 3v12"></path>
        <path d="M7.5 10.5 12 15l4.5-4.5"></path>
        <path d="M4 20h16"></path>
      </>
    ),
    num: "03",
    titleKey: "step3Title",
    descKey: "step3Desc",
    variant: "right",
  },
];

export function HowItWorks() {
  const t = useTranslations("home.howItWorks");

  return (
    <section style={{ background: "var(--cs-bg)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(64px,8vw,104px) 24px" }}>
        <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(30px,4.4vw,48px)", lineHeight: 1.06, letterSpacing: "-.035em" }}>
          {t("title")}
        </Reveal>
        <div data-steps style={{ marginTop: "clamp(36px,5vw,56px)", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
          {STEPS.map((s, i) => (
            <Reveal
              key={s.num}
              variant={s.variant}
              style={{
                padding: i === 0 ? "28px 28px 28px 0" : "28px",
                borderTop: "1.5px solid var(--cs-line)",
                borderLeft: i === 0 ? undefined : "1px solid var(--cs-line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: "none", width: 64, height: 64, borderRadius: "50%", background: "var(--cs-grad-135)", display: "grid", placeItems: "center", color: "#fff" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {s.icon}
                  </svg>
                </div>
                <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: ".02em", color: "var(--cs-accent)" }}>{s.num}</div>
              </div>
              <div style={{ marginTop: 20, fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: "clamp(19px,2vw,23px)", fontWeight: 600, letterSpacing: "-.025em" }}>{t(s.titleKey)}</div>
              <div style={{ marginTop: 9, fontSize: 14.5, lineHeight: 1.55, color: "var(--cs-text-2)", maxWidth: 280 }}>{t(s.descKey)}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/reveal";
import { ChatTool } from "@/components/ai/chat-tool";

export const metadata = {
  title: "Chat with a PDF — Claira Slate",
  description: "Ask a document questions and get grounded answers with citations back to the source.",
};

const STEP_ICONS = [
  (
    <>
      <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.24"></path>
      <path d="M12 21v-8"></path>
      <path d="M8 17l4-4 4 4"></path>
    </>
  ),
  <path key="2" d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"></path>,
  (
    <>
      <path d="M12 3v12"></path>
      <path d="M7.5 10.5 12 15l4.5-4.5"></path>
      <path d="M4 20h16"></path>
    </>
  ),
];

const OTHER_AI = [
  { slug: "summarize", href: "/ai/summarize", icon: <path d="M13.5 2.5 4 14h6.5L9.5 21.5 20 10h-7z"></path> },
  { slug: "translate", href: "/ai/translate", icon: <path d="M4 6h9M8.5 6c0 5-2 8-5.5 10M6 11c1.5 3 4 4.5 7 5M13 20l4-10 4 10M14.6 17h4.8"></path> },
  { slug: "ocr", href: "/ai/ocr", icon: <path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 12h8"></path> },
  { slug: "merge", href: "/tools/merge", icon: <path d="M3 3h10v10H3zM11 11h10v10H11z"></path> },
];

export default function ChatPage() {
  const t = useTranslations("ai");
  const tc = useTranslations("common");
  const tt = useTranslations("tools");
  const STEPS = [
    { n: "01", title: t("chatPage.step1Title"), desc: t("chatPage.step1Desc"), icon: STEP_ICONS[0] },
    { n: "02", title: t("chatPage.step2Title"), desc: t("chatPage.step2Desc"), icon: STEP_ICONS[1] },
    { n: "03", title: t("chatPage.step3Title"), desc: t("chatPage.step3Desc"), icon: STEP_ICONS[2] },
  ];

  return (
    <div>
      <section style={{ padding: "clamp(48px,6vw,88px) 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 21.88, fontWeight: 500, color: "var(--cs-text-2)" }}>
          <Link href="/" className="hover-text" style={{ cursor: "pointer", color: "var(--cs-text-2)" }}>{tc("breadcrumb.home")}</Link>
          <span style={{ color: "var(--cs-line)" }}>/</span>
          <Link href="/ai" className="hover-text" style={{ cursor: "pointer", color: "var(--cs-text-2)" }}>{tc("breadcrumb.ai")}</Link>
          <span style={{ color: "var(--cs-line)" }}>/</span>
          <span style={{ color: "var(--cs-text)" }}>{t("chat.name")}</span>
        </div>
        <div style={{ marginTop: "clamp(28px,3.5vw,44px)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}>
          <span style={{ padding: "5px 11px", borderRadius: 99, background: "var(--cs-accent)", color: "#fff", fontSize: 20.12, fontWeight: 600 }}>{t("toolBadge")}</span>
          <h1 style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(59.5px,8.75vw,98px)", lineHeight: 1.04, letterSpacing: "-.04em" }}>
            {t("chatPage.title")}
          </h1>
          <p style={{ margin: 0, maxWidth: 520, fontSize: "clamp(26.25px,2.45vw,31.5px)", lineHeight: 1.6, color: "var(--cs-text-2)", textWrap: "pretty" }}>
            {t("chatPage.subhead")}
          </p>
        </div>
      </section>

      <section style={{ padding: "clamp(36px,5vw,60px) 24px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))", gap: 16, alignItems: "start" }}>
          <ChatTool />
        </div>
      </section>

      <section style={{ padding: "clamp(56px,7vw,96px) 24px 0" }}>
        <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(45.5px,5.95vw,66.5px)", lineHeight: 1.08, letterSpacing: "-.035em" }}>
          {t("chatPage.howItWorks")}
        </Reveal>
        <div data-steps style={{ marginTop: "clamp(28px,4vw,44px)", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              style={{
                padding: i === 0 ? "26px 26px 26px 0" : "26px",
                borderTop: i === 0 ? "1.5px solid var(--cs-text)" : "1.5px solid var(--cs-line)",
                borderLeft: i === 0 ? undefined : "1px solid var(--cs-line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: "none", width: 56, height: 56, borderRadius: "50%", background: "var(--cs-grad-135)", display: "grid", placeItems: "center", color: "#fff" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {s.icon}
                  </svg>
                </div>
                <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 22.75, fontWeight: 600, letterSpacing: ".02em", color: "var(--cs-accent)" }}>{s.n}</div>
              </div>
              <div style={{ marginTop: 18, fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: "clamp(29.75px,3.15vw,35px)", fontWeight: 600, letterSpacing: "-.025em" }}>{s.title}</div>
              <div style={{ marginTop: 8, fontSize: 24.5, lineHeight: 1.55, color: "var(--cs-text-2)", maxWidth: 260 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "clamp(56px,7vw,96px) 24px clamp(56px,7vw,96px)" }}>
        <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(45.5px,5.95vw,66.5px)", lineHeight: 1.08, letterSpacing: "-.035em" }}>
          {t("otherAiTools")}
        </Reveal>
        <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(232px,100%),1fr))", gap: 12 }}>
          {OTHER_AI.map((o, i) => (
            <Reveal key={o.slug} variant="scale" index={i}>
              <Link
                data-lift
                data-card
                href={o.href}
                style={{ display: "block", padding: 18, border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-card)", color: "var(--cs-text)", cursor: "pointer" }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", display: "grid", placeItems: "center", color: "var(--cs-accent)" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                    {o.icon}
                  </svg>
                </div>
                <div data-shine style={{ marginTop: 14, fontSize: 25.38, fontWeight: 600, letterSpacing: "-.015em" }}>{o.slug === "merge" ? tt("merge.name") : t(`${o.slug}.name`)}</div>
                <div style={{ marginTop: 5, fontSize: 22.75, lineHeight: 1.45, color: "var(--cs-text-2)" }}>{o.slug === "merge" ? tt("merge.desc") : t(`${o.slug}.desc`)}</div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

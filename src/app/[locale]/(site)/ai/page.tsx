import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/reveal";

export const metadata = {
  title: "AI PDF Tools — Summarize, Chat, Translate — Claira Slate",
  description: "Four models, one document. Summarize it, question it, translate it, or make a scan searchable.",
};

const AI_CARDS = [
  {
    key: "summarize",
    href: "/ai/summarize",
    icon: <path d="M4 6h16M4 11h16M4 16h9"></path>,
  },
  {
    key: "chat",
    href: "/ai/chat",
    icon: <path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"></path>,
  },
  {
    key: "translate",
    href: "/ai/translate",
    icon: <path d="M4 6h9M8.5 6c0 5-2 8-5.5 10M6 11c1.5 3 4 4.5 7 5M13 20l4-10 4 10M14.6 17h4.8"></path>,
  },
  {
    key: "ocr",
    href: "/ai/ocr",
    icon: <path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 12h8"></path>,
  },
];

const TRUST = [
  { label: "Never used for training", d: "M4 12.5l5 5L20 6.5" },
  { label: "Deleted after 1 hour", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2" },
  { label: "EU data residency", d: "M12 3l8 3v6c0 5-3.5 7.7-8 9-4.5-1.3-8-4-8-9V6z" },
];

export default function AiHubPage() {
  const t = useTranslations("ai");

  return (
    <div>
      <section
        id="aitop"
        style={{ position: "relative", marginTop: -68, background: "var(--cs-bg)", color: "var(--cs-text)", overflow: "hidden" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.5,
            backgroundImage:
              "linear-gradient(var(--cs-line) 1px,transparent 1px),linear-gradient(90deg,var(--cs-line) 1px,transparent 1px)",
            backgroundSize: "56px 56px",
            pointerEvents: "none",
          }}
        ></div>
        <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto", padding: "calc(clamp(56px,8vw,112px) + 68px) 24px clamp(56px,7vw,96px)" }}>
          <span data-spinborder style={{ display: "inline-block", padding: "6px 13px", borderRadius: 99, background: "var(--cs-accent)", color: "#fff", fontSize: 12, fontWeight: 600 }}>
            Powered by AI
          </span>
          <h1
            style={{
              margin: "22px 0 0",
              maxWidth: 800,
              fontFamily: "var(--font-geist), Inter, sans-serif",
              fontWeight: 600,
              fontSize: "clamp(36px,6vw,66px)",
              lineHeight: 1.02,
              letterSpacing: "-.042em",
              textWrap: "balance",
            }}
          >
            Your PDF, finally understood.
          </h1>
          <p style={{ margin: "20px 0 0", maxWidth: 540, fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "var(--cs-text-2)", textWrap: "pretty" }}>
            Four models, one document. Summarize it, question it, translate it, or make a scan searchable — then keep working with the other 26 tools.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Link
              data-press
              data-arrow
              href="/signup"
              className="hover-text"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 10, background: "var(--cs-grad)", color: "#fff", fontSize: 15, fontWeight: 500, cursor: "pointer" }}
            >
              Try AI free <span data-tip>&rarr;</span>
            </Link>
            <Link
              data-press
              href="/ai/summarize"
              style={{ display: "inline-flex", alignItems: "center", padding: "13px 22px", borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 15, fontWeight: 500, cursor: "pointer" }}
            >
              See how it works
            </Link>
          </div>
          <div style={{ marginTop: "clamp(44px,6vw,72px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(238px,100%),1fr))", gap: 14 }}>
            {AI_CARDS.map((c, i) => (
              <Reveal key={c.key} variant="fade" index={i}>
                <Link
                  data-spring
                  data-lift
                  data-gradient-top
                  href={c.href}
                  className="hover-border-white"
                  style={{ display: "block", padding: 24, border: "1px solid var(--cs-ink-line)", borderRadius: "var(--cs-r)", background: "var(--cs-ink-2)", color: "#fff", cursor: "pointer" }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--cs-grad-135)", display: "grid", placeItems: "center", color: "#fff" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                      {c.icon}
                    </svg>
                  </div>
                  <div style={{ marginTop: 18, fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: "-.02em" }}>{t(`${c.key}.name`)}</div>
                  <div style={{ marginTop: 7, fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,.58)" }}>{t(`${c.key}.desc`)}</div>
                  <div style={{ marginTop: 16, fontSize: 13, fontWeight: 500, color: "var(--cs-accent)" }}>Open tool &rarr;</div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,7vw,96px) 24px" }}>
        <Reveal
          as="h2"
          style={{ margin: 0, maxWidth: 640, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.06, letterSpacing: "-.035em", textWrap: "balance" }}
        >
          Answers with a page number attached.
        </Reveal>
        <p style={{ margin: "16px 0 0", maxWidth: 520, fontSize: 16, lineHeight: 1.6, color: "var(--cs-text-2)", textWrap: "pretty" }}>
          Every response cites the section it came from, so you can check it in one click.
        </p>
        <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))", gap: 14 }}>
          <Reveal variant="left" style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--cs-text-2)" }}>Document</div>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 9 }}>
              <div data-skeleton style={{ height: 9, borderRadius: 99, width: "88%" }}></div>
              <div data-skeleton style={{ height: 9, borderRadius: 99, width: "96%" }}></div>
              <div style={{ height: 9, borderRadius: 99, background: "var(--cs-accent-line)", width: "72%" }}></div>
              <div data-skeleton style={{ height: 9, borderRadius: 99, width: "92%" }}></div>
              <div data-skeleton style={{ height: 9, borderRadius: 99, width: "64%" }}></div>
              <div data-skeleton style={{ height: 9, borderRadius: 99, width: "84%" }}></div>
              <div data-skeleton style={{ height: 9, borderRadius: 99, width: "46%" }}></div>
            </div>
            <div style={{ marginTop: 20, fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)" }}>supplier-agreement.pdf &middot; 64 pages</div>
          </Reveal>
          <Reveal variant="right" style={{ border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--cs-accent)" }}>Claira AI</div>
            <div style={{ alignSelf: "flex-end", maxWidth: "86%", padding: "10px 13px", borderRadius: "12px 12px 4px 12px", background: "var(--cs-accent)", color: "#fff", fontSize: 13, lineHeight: 1.45 }}>
              Can we terminate early, and what does it cost?
            </div>
            <div style={{ maxWidth: "94%", padding: "12px 14px", borderRadius: "12px 12px 12px 4px", background: "var(--cs-bg-2)", border: "1px solid var(--cs-line)", fontSize: 13, lineHeight: 1.55 }}>
              Yes — with 60 days&apos; written notice after month 12. Exiting earlier carries a fee equal to two months of committed spend.
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ padding: "3px 8px", borderRadius: 6, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", fontSize: 11, fontWeight: 500, color: "var(--cs-accent)" }}>&sect;9.1 &middot; p. 27</span>
                <span style={{ padding: "3px 8px", borderRadius: 6, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", fontSize: 11, fontWeight: 500, color: "var(--cs-accent)" }}>&sect;9.4 &middot; p. 29</span>
              </div>
            </div>
            <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid var(--cs-line)", borderRadius: 10, fontSize: 13, color: "var(--cs-text-2)" }}>
              Ask a follow-up&hellip;
            </div>
          </Reveal>
        </div>
        <div style={{ marginTop: 34, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {TRUST.map((t) => (
            <div
              key={t.label}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 15px", border: "1px solid var(--cs-line)", borderRadius: 99, fontSize: 13, fontWeight: 500, color: "var(--cs-text-2)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2" strokeLinecap="round">
                <path d={t.d}></path>
              </svg>
              {t.label}
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "var(--cs-grad-135)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,7vw,96px) 24px", textAlign: "center" }}>
          <Reveal
            as="h2"
            style={{ margin: "0 auto", maxWidth: 680, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(28px,4.6vw,52px)", lineHeight: 1.05, letterSpacing: "-.04em", color: "#fff", textWrap: "balance" }}
          >
            Two free AI actions a day. No card.
          </Reveal>
          <Link
            data-press
            href="/signup"
            className="hover-text"
            style={{ marginTop: 30, display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 26px", borderRadius: 10, background: "#fff", color: "var(--cs-accent)", fontSize: 15.5, fontWeight: 600, cursor: "pointer" }}
          >
            Start with AI
          </Link>
        </div>
      </section>
    </div>
  );
}

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";

export const metadata = {
  title: "About — Claira Slate",
  description: "Claira Slate started in 2024 as a weekend fix for a broken merge tool. Today it processes millions of documents a month.",
};

const STATS: { label: string; content: ReactNode }[] = [
  {
    label: "documents processed",
    content: (
      <>
        <CountUp value={48} />
        M+
      </>
    ),
  },
  { label: "maximum retention", content: "1 h" },
  { label: "people, 7 countries", content: "19" },
  { label: "ads, ever", content: "0" },
];

const VALUES = [
  {
    title: "Nothing before the first file",
    body: "No signup wall, no email gate, no watermark held hostage. The tool works, then you decide.",
  },
  {
    title: "Your document is yours",
    body: "Encrypted in transit, isolated in processing, deleted within the hour. Never used to train a model.",
  },
  {
    title: "Answers you can check",
    body: "Every AI response cites its page. If we cannot show you where it came from, we do not ship it.",
  },
];

const TRUST = [
  {
    label: "Privacy",
    body: "We collect the minimum needed to run the service, and we never sell it. Plain-language policy, no dark patterns.",
  },
  {
    label: "Security",
    body: "TLS 1.3 in transit, AES-256 at rest, isolated processing containers, annual third-party pen test.",
  },
  {
    label: "GDPR & terms",
    body: "EU data residency, DPA on request, one-hour retention by default and custom windows on Business.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,8vw,104px) 24px 0" }}>
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
          We make document work boring again.
        </h1>
        <p style={{ margin: "22px 0 0", maxWidth: 560, fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.65, color: "var(--cs-text-2)" }}>
          Claira Slate started in 2024 as a weekend fix for a broken merge tool. Today it processes millions of
          documents a month for people who never want to think about PDFs at all.
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
          {STATS.map((s, i) => (
            <div key={s.label} style={{ padding: i === 0 ? "24px 24px 24px 0" : "24px", borderLeft: i === 0 ? "none" : "1px solid var(--cs-line)" }}>
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: "clamp(28px,3.4vw,38px)", fontWeight: 600, letterSpacing: "-.04em", color: "var(--cs-accent)" }}>
                {s.content}
              </div>
              <div style={{ marginTop: 6, fontSize: 13.5, color: "var(--cs-text-2)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,7vw,96px) 24px 0" }}>
        <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(26px,3.4vw,40px)", lineHeight: 1.08, letterSpacing: "-.035em" }}>
          What we hold to
        </Reveal>
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(268px,100%),1fr))", gap: 14 }}>
          {VALUES.map((v, i) => (
            <Reveal
              key={v.title}
              variant="scale"
              index={i}
              data-lift
              style={{ padding: 26, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}
            >
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: "-.02em" }}>{v.title}</div>
              <div style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.6, color: "var(--cs-text-2)" }}>{v.body}</div>
            </Reveal>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,7vw,96px) 24px 0" }}>
        <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(26px,3.4vw,40px)", lineHeight: 1.08, letterSpacing: "-.035em" }}>
          Trust &amp; privacy
        </Reveal>
        <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(240px,100%),1fr))", gap: 14 }}>
          {TRUST.map((t) => (
            <div key={t.label} style={{ padding: 22, border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-card)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--cs-text-2)" }}>{t.label}</div>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--cs-text-2)" }}>{t.body}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link
            href="/contact"
            className="hover-bg"
            style={{ padding: "12px 20px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}
          >
            Request a DPA
          </Link>
          <Link
            href="/blog"
            className="hover-text"
            style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}
          >
            Read the engineering notes
          </Link>
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,7vw,96px) 24px clamp(56px,7vw,96px)" }}>
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
              We are hiring quiet, careful builders.
            </div>
            <div style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
              Remote-first across Europe. Three open roles in infrastructure and design.
            </div>
          </div>
          <Link
            href="/contact"
            className="hover-bg"
            style={{ padding: "12px 20px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            See open roles &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}

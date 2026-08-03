import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/reveal";

const CHECK = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none", marginTop: 3 }}>
    <path d="M4 12.5l5 5L20 6.5"></path>
  </svg>
);

export function PricingTeaser() {
  const tp = useTranslations("pricing");
  const th = useTranslations("home.pricingTeaser");
  const freeFeatures = tp.raw("free.features") as string[];
  const proFeatures = tp.raw("pro.features") as string[];
  const businessFeatures = tp.raw("business.features") as string[];

  return (
    <section id="pricing" style={{ borderTop: "1px solid var(--cs-line)", background: "var(--cs-bg-2)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(64px,8vw,104px) 24px" }}>
        <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(45px,6.6vw,72px)", lineHeight: 1.06, letterSpacing: "-.035em" }}>
          {tp("headline")}
        </Reveal>
        <p style={{ margin: "14px 0 0", maxWidth: 440, fontSize: 24, color: "var(--cs-text-2)" }}>{th("subhead")}</p>
        <div style={{ marginTop: "clamp(36px,5vw,52px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(268px,1fr))", gap: 14, alignItems: "start" }}>
          <Reveal variant="scale" index={0} data-lift style={{ padding: 26, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}>
            <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.01em" }}>{tp("free.name")}</div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 60, fontWeight: 600, letterSpacing: "-.04em" }}>$0</span>
              <span style={{ fontSize: 21, color: "var(--cs-text-2)" }}>{tp("free.unit")}</span>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
              {freeFeatures.slice(0, 3).map((f) => (
                <div key={f} style={{ display: "flex", gap: 9, fontSize: 21, color: "var(--cs-text-2)" }}>{CHECK}{f}</div>
              ))}
            </div>
            <Link
              href="/signup"
              className="hover-border hover-text"
              style={{ marginTop: 24, display: "block", textAlign: "center", padding: 11, borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 21, fontWeight: 500, cursor: "pointer" }}
            >
              {tp("free.cta")}
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
              <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.01em", color: "var(--cs-accent)" }}>{tp("pro.name")}</div>
              <div style={{ padding: "4px 10px", borderRadius: 99, background: "var(--cs-grad)", color: "#fff", fontSize: 16.5, fontWeight: 600 }}>{tp("pro.badge")}</div>
            </div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 60, fontWeight: 600, letterSpacing: "-.04em" }}>$5</span>
              <span style={{ fontSize: 21, color: "var(--cs-text-2)" }}>{tp("pro.unit")}</span>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
              {proFeatures.slice(0, 3).map((f) => (
                <div key={f} style={{ display: "flex", gap: 9, fontSize: 21, color: "var(--cs-text-2)" }}>{CHECK}{f}</div>
              ))}
            </div>
            <Link
              href="/signup"
              style={{ marginTop: 24, display: "block", textAlign: "center", padding: 11, borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 21, fontWeight: 500, cursor: "pointer" }}
            >
              {tp("pro.cta")}
            </Link>
          </Reveal>

          <Reveal variant="scale" index={2} data-lift style={{ padding: 26, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}>
            <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.01em" }}>{tp("business.name")}</div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 60, fontWeight: 600, letterSpacing: "-.04em" }}>$12</span>
              <span style={{ fontSize: 21, color: "var(--cs-text-2)" }}>{tp("business.unit")}</span>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
              {businessFeatures.slice(0, 3).map((f) => (
                <div key={f} style={{ display: "flex", gap: 9, fontSize: 21, color: "var(--cs-text-2)" }}>{CHECK}{f}</div>
              ))}
            </div>
            <Link
              href="/contact"
              className="hover-border hover-text"
              style={{ marginTop: 24, display: "block", textAlign: "center", padding: 11, borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 21, fontWeight: 500, cursor: "pointer" }}
            >
              {tp("business.cta")}
            </Link>
          </Reveal>
        </div>
        <div style={{ marginTop: 30 }}>
          <Link href="/pricing" style={{ fontSize: 21.75, fontWeight: 500, cursor: "pointer" }}>
            {th("seeFullPricing")} &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

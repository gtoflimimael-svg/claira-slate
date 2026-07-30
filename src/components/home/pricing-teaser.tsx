import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/reveal";

const CHECK = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cs-ok)" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none", marginTop: 3 }}>
    <path d="M4 12.5l5 5L20 6.5"></path>
  </svg>
);

export function PricingTeaser() {
  return (
    <section id="pricing" style={{ borderTop: "1px solid var(--cs-line)", background: "var(--cs-bg-2)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(64px,8vw,104px) 24px" }}>
        <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(30px,4.4vw,48px)", lineHeight: 1.06, letterSpacing: "-.035em" }}>
          Simple pricing. No surprises.
        </Reveal>
        <p style={{ margin: "14px 0 0", maxWidth: 440, fontSize: 16, color: "var(--cs-text-2)" }}>Every tool is free to try. Upgrade when you need volume.</p>
        <div style={{ marginTop: "clamp(36px,5vw,52px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(268px,1fr))", gap: 14, alignItems: "start" }}>
          <Reveal variant="scale" index={0} data-lift style={{ padding: 26, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }}>Free</div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 40, fontWeight: 600, letterSpacing: "-.04em" }}>$0</span>
              <span style={{ fontSize: 14, color: "var(--cs-text-2)" }}>forever</span>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}All 26 tools, no watermarks</div>
              <div style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}2 AI actions per day</div>
              <div style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}Files up to 25 MB</div>
            </div>
            <Link
              href="/signup"
              className="hover-border hover-text"
              style={{ marginTop: 24, display: "block", textAlign: "center", padding: 11, borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              Start free
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
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.01em", color: "var(--cs-accent)" }}>Pro</div>
              <div style={{ padding: "4px 10px", borderRadius: 99, background: "var(--cs-grad)", color: "#fff", fontSize: 11, fontWeight: 600 }}>Most popular</div>
            </div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 40, fontWeight: 600, letterSpacing: "-.04em" }}>$5</span>
              <span style={{ fontSize: 14, color: "var(--cs-text-2)" }}>/month</span>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}Unlimited tools &amp; AI actions</div>
              <div style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}Files up to 2 GB, batch mode</div>
              <div style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}Desktop &amp; mobile apps</div>
            </div>
            <Link
              href="/signup"
              style={{ marginTop: 24, display: "block", textAlign: "center", padding: 11, borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              Get Pro
            </Link>
          </Reveal>

          <Reveal variant="scale" index={2} data-lift style={{ padding: 26, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }}>Business</div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 40, fontWeight: 600, letterSpacing: "-.04em" }}>$12</span>
              <span style={{ fontSize: 14, color: "var(--cs-text-2)" }}>/user/month</span>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}Everything in Pro</div>
              <div style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}Shared workspaces &amp; SSO</div>
              <div style={{ display: "flex", gap: 9, fontSize: 14, color: "var(--cs-text-2)" }}>{CHECK}Audit log &amp; priority support</div>
            </div>
            <Link
              href="/contact"
              className="hover-border hover-text"
              style={{ marginTop: 24, display: "block", textAlign: "center", padding: 11, borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              Contact sales
            </Link>
          </Reveal>
        </div>
        <div style={{ marginTop: 30 }}>
          <Link href="/pricing" style={{ fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}>
            See full pricing &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

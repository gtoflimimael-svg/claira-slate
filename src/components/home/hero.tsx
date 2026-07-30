import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const HEADLINE_MARKER = "⁣";

export function Hero() {
  const t = useTranslations("hero");
  const aiWord = t("ai");
  const [headlineBefore, headlineAfter] = t("headline", { ai: HEADLINE_MARKER }).split(HEADLINE_MARKER);

  return (
    <section
      id="top"
      style={{
        position: "relative",
        maxWidth: 1200,
        margin: "-68px auto 0",
        padding: "calc(clamp(72px,11vw,140px) + 68px) 24px clamp(72px,9vw,120px)",
        background:
          "radial-gradient(58% 50% at 40% 16%, color-mix(in oklab, var(--cs-accent) 7%, transparent), transparent 70%), radial-gradient(48% 42% at 86% 6%, color-mix(in oklab, var(--cs-cyan) 7%, transparent), transparent 72%)",
      }}
    >
      <div
        data-heroart
        style={{
          position: "absolute",
          top: "clamp(64px,9vw,120px)",
          right: "clamp(-8px,0vw,8px)",
          width: "clamp(340px,37vw,540px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/uploads/Freelancer-cuate.svg" alt="" width={500} height={500} style={{ width: "100%", height: "auto", display: "block" }} />
        <svg viewBox="0 0 500 500" width="100%" fill="none" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          <g fill="var(--cs-accent)">
            <circle cx="120" cy="120" r="3" style={{ animation: "csSpeck 3.6s ease-in-out infinite" }}></circle>
            <circle cx="340" cy="96" r="2.6" style={{ animation: "csSpeck 4.4s ease-in-out .7s infinite" }}></circle>
            <circle cx="446" cy="188" r="2.4" style={{ animation: "csSpeck 4s ease-in-out 1.4s infinite" }}></circle>
            <circle cx="66" cy="238" r="2.4" style={{ animation: "csSpeck 4.8s ease-in-out 2.1s infinite" }}></circle>
            <circle cx="286" cy="66" r="2.2" style={{ animation: "csSpeck 3.4s ease-in-out 2.7s infinite" }}></circle>
          </g>
        </svg>
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 820 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-geist), Inter, sans-serif",
            fontWeight: 600,
            fontSize: "clamp(42px,7.2vw,78px)",
            lineHeight: 1.02,
            letterSpacing: "-.042em",
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
            maxWidth: 560,
            fontSize: "clamp(16px,1.5vw,19px)",
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
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {t("ctaPrimary")} <span data-tip style={{ fontSize: 15 }}>&rarr;</span>
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
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {t("ctaSecondary")}
          </Link>
        </div>
        <div style={{ margin: "22px 0 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, fontSize: 13.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
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
        data-reveal="scale"
        style={{ marginTop: "clamp(96px,13vw,184px)", border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: "1px solid var(--cs-line)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--cs-line)" }}></span>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--cs-line)" }}></span>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--cs-line)" }}></span>
          <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 500, color: "var(--cs-text-2)", letterSpacing: "-.01em" }}>
            clairaslate.com/compress
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>
          <div
            style={{
              flex: "0 0 208px",
              minWidth: 208,
              padding: "20px 16px",
              borderRight: "1px solid var(--cs-line)",
              background: "var(--cs-bg-2)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, background: "var(--cs-accent)", color: "#fff", fontSize: 13, fontWeight: 500 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 3v6M9 6l3 3 3-3M12 21v-6M9 18l3-3 3 3M4 12h16"></path>
              </svg>
              Compress
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, color: "var(--cs-text-2)", fontSize: 13, fontWeight: 500 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 3h10v10H3zM11 11h10v10H11z"></path>
              </svg>
              Merge
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, color: "var(--cs-text-2)", fontSize: 13, fontWeight: 500 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 3v18M5 8l-3 4 3 4M19 8l3 4-3 4"></path>
              </svg>
              Split
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, color: "var(--cs-text-2)", fontSize: 13, fontWeight: 500 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3"></path>
              </svg>
              Protect
            </div>
            <div style={{ marginTop: "auto", padding: 10, borderRadius: 8, border: "1px dashed var(--cs-accent-line)", fontSize: 11.5, fontWeight: 500, color: "var(--cs-accent)", lineHeight: 1.4 }}>
              26 tools &middot; all free
              <br />
              to try
            </div>
          </div>
          <div style={{ flex: "1 1 380px", minWidth: 300, padding: 22 }}>
            <div
              style={{
                border: "1.5px dashed var(--cs-accent-line)",
                borderRadius: 14,
                background: "var(--cs-accent-soft)",
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                animation: "csPulseBorder 2s ease-in-out infinite",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, background: "var(--cs-card)", border: "1px solid var(--cs-line)" }}>
                <div style={{ flex: "0 0 34px", height: 42, borderRadius: 5, border: "1px solid var(--cs-line)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 600, color: "var(--cs-bad)", letterSpacing: ".02em" }}>
                  PDF
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontWeight: 500, color: "var(--cs-text)" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Q3-report-final.pdf</span>
                    <span style={{ color: "var(--cs-text-2)", fontWeight: 400, flex: "none" }}>18.4 MB</span>
                  </div>
                  <div style={{ marginTop: 9, height: 5, borderRadius: 99, background: "var(--cs-line)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "var(--cs-grad)", width: "56%", animation: "csFill 3.4s ease-in-out infinite alternate" }}></div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
                    Compressing
                    <span style={{ animation: "csDot 1.2s infinite" }}>.</span>
                    <span style={{ animation: "csDot 1.2s .2s infinite" }}>.</span>
                    <span style={{ animation: "csDot 1.2s .4s infinite" }}>.</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, background: "var(--cs-card)", border: "1px solid var(--cs-line)" }}>
                <div style={{ flex: "0 0 34px", height: 42, borderRadius: 5, border: "1px solid var(--cs-line)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 600, color: "var(--cs-bad)", letterSpacing: ".02em" }}>
                  PDF
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontWeight: 500 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>contract-2026.pdf</span>
                    <span style={{ color: "var(--cs-text-2)", fontWeight: 400, flex: "none" }}>2.1 MB</span>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 500, color: "var(--cs-ok)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M4 12.5l5 5L20 6.5"></path>
                    </svg>
                    Done &middot; 74% smaller
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 11, borderRadius: 10, fontSize: 12.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
                Drop files here or click to browse
              </div>
            </div>
          </div>
          <div style={{ flex: "0 0 268px", minWidth: 248, padding: 22, borderLeft: "1px solid var(--cs-line)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--cs-accent)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cs-accent)" }}></span>
              Claira AI
            </div>
            <div style={{ alignSelf: "flex-end", maxWidth: "88%", padding: "10px 13px", borderRadius: "12px 12px 4px 12px", background: "var(--cs-accent)", color: "#fff", fontSize: 12.5, lineHeight: 1.45 }}>
              What are the payment terms in this contract?
            </div>
            <div style={{ maxWidth: "94%", padding: "10px 13px", borderRadius: "12px 12px 12px 4px", background: "var(--cs-bg-2)", border: "1px solid var(--cs-line)", fontSize: 12.5, lineHeight: 1.5, color: "var(--cs-text)" }}>
              Net 30 from invoice date, with a 1.5% monthly late fee (&sect;4.2, p.&nbsp;11)
              <span style={{ display: "inline-block", width: 2, height: 12, marginLeft: 2, background: "var(--cs-accent)", verticalAlign: -2, animation: "csCaret 1s step-end infinite" }}></span>
            </div>
            <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid var(--cs-line)", borderRadius: 10, fontSize: 12.5, color: "var(--cs-text-2)" }}>
              Ask anything&hellip;
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

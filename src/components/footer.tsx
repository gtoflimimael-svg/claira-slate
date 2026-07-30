"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";

const linkStyle = { cursor: "pointer", fontSize: 13.5, color: "var(--cs-text-2)" } as const;
const colTitleStyle = { fontSize: 12.5, fontWeight: 600, letterSpacing: ".02em", color: "var(--cs-text)" } as const;

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer style={{ background: "var(--cs-bg)", borderTop: "1px solid var(--cs-line)" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "clamp(52px,6vw,76px) 24px 40px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: 40,
        }}
      >
        <div style={{ minWidth: 200 }}>
          <svg width="40" height="40" viewBox="0 0 120 120" fill="none" role="img" aria-label="Claira Slate">
            <path d="M62 28C42 28 26 42 26 60C26 78 42 92 62 92" fill="none" stroke="var(--cs-accent)" strokeWidth="12" strokeLinecap="round"></path>
            <path
              d="M68 28C88 28 94 38 94 47C94 56 84 60 74 60C64 60 54 64 54 73C54 82 60 92 80 92"
              fill="none"
              stroke="var(--cs-logo-s)"
              strokeWidth="12"
              strokeLinecap="round"
            ></path>
          </svg>
          <div style={{ marginTop: 12, fontSize: 14, color: "var(--cs-text-2)", maxWidth: 220 }}>{t("tagline")}</div>
        </div>
        <div>
          <div style={colTitleStyle}>{t("colTools")}</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
            <Link href="/tools/merge" className="hover-text" style={linkStyle}>{t("mergePdf")}</Link>
            <Link href="/tools" className="hover-text" style={linkStyle}>{t("compressPdf")}</Link>
            <Link href="/tools" className="hover-text" style={linkStyle}>{t("pdfToWord")}</Link>
            <Link href="/ai" className="hover-text" style={linkStyle}>{t("aiTools")}</Link>
          </div>
        </div>
        <div>
          <div style={colTitleStyle}>{t("colCompany")}</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
            <Link href="/about" className="hover-text" style={linkStyle}>{t("about")}</Link>
            <Link href="/blog" className="hover-text" style={linkStyle}>{t("blog")}</Link>
            <Link href="/pricing" className="hover-text" style={linkStyle}>{t("pricing")}</Link>
            <Link href="/about" className="hover-text" style={linkStyle}>{t("careers")}</Link>
          </div>
        </div>
        <div>
          <div style={colTitleStyle}>{t("colLegal")}</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
            <Link href="/about" className="hover-text" style={linkStyle}>{t("privacy")}</Link>
            <Link href="/about" className="hover-text" style={linkStyle}>{t("terms")}</Link>
            <Link href="/about" className="hover-text" style={linkStyle}>{t("security")}</Link>
            <Link href="/about" className="hover-text" style={linkStyle}>{t("gdpr")}</Link>
          </div>
        </div>
        <div>
          <div style={colTitleStyle}>{t("colConnect")}</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
            <Link data-pop href="/contact" className="hover-accent" style={linkStyle}>{t("twitter")}</Link>
            <Link data-pop href="/contact" className="hover-accent" style={linkStyle}>{t("linkedin")}</Link>
            <Link data-pop href="/contact" className="hover-accent" style={linkStyle}>{t("github")}</Link>
            <Link data-pop href="/contact" className="hover-accent" style={linkStyle}>{t("support")}</Link>
          </div>
        </div>
      </div>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "22px 24px 44px",
          borderTop: "1px solid var(--cs-line)",
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          justifyContent: "space-between",
          fontSize: 12.5,
          color: "var(--cs-text-2)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
          <LanguageSwitcher direction="up" />
          <span data-type>{t("copyright")}</span>
        </div>
        <span>{t("madeFor")}</span>
      </div>
    </footer>
  );
}

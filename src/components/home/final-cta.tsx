import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function FinalCta() {
  const t = useTranslations("home.finalCta");
  return (
    <section id="cta" style={{ background: "var(--cs-grad-135)" }}>
      <div style={{ padding: "clamp(72px,9vw,120px) 24px", textAlign: "center" }}>
        <h2
          style={{
            margin: "0 auto",
            maxWidth: 760,
            fontFamily: "var(--font-geist), Inter, sans-serif",
            fontWeight: 600,
            fontSize: "clamp(48px,8.1vw,90px)",
            lineHeight: 1.04,
            letterSpacing: "-.04em",
            color: "#fff",
          }}
        >
          {t("title")}
        </h2>
        <Link
          data-press
          href="/signup"
          className="hover-cta"
          style={{
            marginTop: 34,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "15px 26px",
            borderRadius: 10,
            background: "#fff",
            color: "var(--cs-accent)",
            fontSize: 23.25,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}

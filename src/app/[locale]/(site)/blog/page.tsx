"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { POSTS } from "@/lib/data";
import { Reveal } from "@/components/reveal";

const CATS = ["All", "Product", "Engineering", "Guides", "Company"];

function minReadCount(read: string): number {
  return parseInt(read, 10) || 0;
}

export default function BlogPage() {
  const t = useTranslations("blog");
  const [cat, setCat] = useState("All");
  const featured = POSTS[0];
  const rest = POSTS.slice(1);
  const posts = cat === "All" ? rest : rest.filter((p) => p.cat === cat);

  return (
    <>
      <section style={{ padding: "clamp(56px,8vw,104px) 24px 0" }}>
        <h1
          style={{
            margin: 0,
            maxWidth: 620,
            fontFamily: "var(--font-geist), Inter, sans-serif",
            fontWeight: 600,
            fontSize: "clamp(63px,10.5vw,112px)",
            lineHeight: 1.03,
            letterSpacing: "-.042em",
          }}
        >
          {t("headline")}
        </h1>
        <p style={{ margin: "20px 0 0", maxWidth: 480, fontSize: "clamp(26.25px,2.62vw,31.5px)", lineHeight: 1.6, color: "var(--cs-text-2)" }}>
          {t("subheadline")}
        </p>

        <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 7 }}>
          {CATS.map((c) => {
            const active = c === cat;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  padding: "8px 13px",
                  borderRadius: 99,
                  border: "1px solid",
                  borderColor: active ? "var(--cs-accent)" : "var(--cs-line)",
                  background: active ? "var(--cs-accent)" : "transparent",
                  color: active ? "#fff" : "var(--cs-text-2)",
                  fontSize: 22.75,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t(`categories.${c}`)}
              </button>
            );
          })}
        </div>

        <Reveal
          as={Link}
          variant="scale"
          data-arrow
          href={`/blog/${featured.slug}`}
          style={{
            marginTop: "clamp(32px,4vw,48px)",
            display: "block",
            padding: "clamp(24px,3vw,36px)",
            border: "1px solid var(--cs-line)",
            borderRadius: 20,
            background: "var(--cs-card)",
            color: "var(--cs-text)",
            cursor: "pointer",
          }}
          className="hover-border hover-text"
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 21, fontWeight: 500, color: "var(--cs-text-2)" }}>
            <span style={{ padding: "4px 10px", borderRadius: 6, background: "var(--cs-grad)", color: "#fff", fontWeight: 600 }}>{t(`categories.${featured.cat}`)}</span>
            <span>{featured.date}</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--cs-text-2)" }}></span>
            <span>{t("minRead", { count: minReadCount(featured.read) })}</span>
          </div>
          <div
            style={{
              marginTop: 18,
              maxWidth: 720,
              fontFamily: "var(--font-geist), Inter, sans-serif",
              fontSize: "clamp(42px,5.95vw,70px)",
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-.035em",
            }}
          >
            {t(`posts.${featured.slug}.title`)}
          </div>
          <div style={{ marginTop: 14, maxWidth: 600, fontSize: 27.12, lineHeight: 1.6, color: "var(--cs-text-2)" }}>{t(`posts.${featured.slug}.excerpt`)}</div>
          <div style={{ marginTop: 22, fontSize: 24.5, fontWeight: 500, color: "var(--cs-accent)" }}>
            {t("readPost")} <span data-tip>&rarr;</span>
          </div>
        </Reveal>
      </section>

      <section style={{ padding: "clamp(28px,4vw,40px) 24px clamp(56px,7vw,96px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(300px,100%),1fr))", gap: 14 }}>
          {posts.map((p, i) => (
            <Reveal
              key={p.slug}
              as={Link}
              variant="scale"
              index={i % 12}
              staggerMs={60}
              data-lift
              href={`/blog/${p.slug}`}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 24,
                border: "1px solid var(--cs-line)",
                borderRadius: "var(--cs-r)",
                background: "var(--cs-card)",
                color: "var(--cs-text)",
                cursor: "pointer",
                minHeight: 220,
              }}
              className="hover-border hover-text"
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, fontSize: 20.12, fontWeight: 500, color: "var(--cs-text-2)" }}>
                <span style={{ padding: "3px 9px", borderRadius: 6, background: "var(--cs-bg-2)", fontWeight: 600 }}>{t(`categories.${p.cat}`)}</span>
                <span>{p.date}</span>
              </div>
              <div style={{ marginTop: 16, fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 31.5, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-.025em" }}>
                {t(`posts.${p.slug}.title`)}
              </div>
              <div style={{ marginTop: 10, fontSize: 24.5, lineHeight: 1.55, color: "var(--cs-text-2)" }}>{t(`posts.${p.slug}.excerpt`)}</div>
              <div style={{ marginTop: "auto", paddingTop: 18, fontSize: 21.88, fontWeight: 500, color: "var(--cs-text-2)" }}>{t("minRead", { count: minReadCount(p.read) })}</div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { TOOLS, CATS } from "@/lib/data";
import { Reveal } from "@/components/reveal";

function toolHref(slug: string): string {
  return slug === "ocr" ? "/ai/ocr" : `/tools/${slug}`;
}

export default function ToolsIndexPage() {
  const t = useTranslations("tools");
  const tc = useTranslations("common");
  const [cat, setCat] = useState("All");
  const shownTools = cat === "All" ? TOOLS : TOOLS.filter((tool) => tool.cat === cat);

  return (
    <div style={{ animation: "csFade .28s ease both" }}>
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,8vw,104px) 24px clamp(28px,4vw,44px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
          <Link href="/" className="hover-text" style={{ cursor: "pointer", color: "var(--cs-text-2)" }}>{tc("breadcrumb.home")}</Link>
          <span style={{ color: "var(--cs-line)" }}>/</span>
          <span style={{ color: "var(--cs-text)" }}>{tc("breadcrumb.tools")}</span>
        </div>
        <h1
          style={{
            margin: "26px 0 0",
            maxWidth: 760,
            fontFamily: "var(--font-geist), Inter, sans-serif",
            fontWeight: 600,
            fontSize: "clamp(36px,6vw,64px)",
            lineHeight: 1.03,
            letterSpacing: "-.042em",
            textWrap: "balance",
          }}
        >
          {t("headline")}
        </h1>
        <p style={{ margin: "20px 0 0", maxWidth: 520, fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "var(--cs-text-2)", textWrap: "pretty" }}>
          {t("subheadline")}
        </p>
        <div style={{ marginTop: 30, display: "flex", flexWrap: "wrap", gap: 7 }}>
          {CATS.map((c) => {
            const active = c === cat;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  padding: "8px 13px",
                  borderRadius: 99,
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "1px solid",
                  background: active ? "var(--cs-accent)" : "transparent",
                  color: active ? "#fff" : "var(--cs-text-2)",
                  borderColor: active ? "var(--cs-accent)" : "var(--cs-line)",
                }}
              >
                {t(`filters.${c}`)}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px clamp(56px,7vw,96px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(248px,100%),1fr))", gap: 12 }}>
          {shownTools.map((tool, i) => (
            <Reveal
              key={tool.slug}
              as={Link}
              variant="scale"
              index={i % 12}
              staggerMs={60}
              data-lift
              data-card
              href={toolHref(tool.slug)}
              style={{
                display: "block",
                padding: 18,
                border: "1px solid var(--cs-line)",
                borderRadius: "var(--cs-r)",
                background: "var(--cs-card)",
                color: "var(--cs-text)",
                cursor: "pointer",
              }}
            >
              <div data-icon style={{ width: 34, height: 34, borderRadius: 8, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", display: "grid", placeItems: "center", color: "var(--cs-accent)" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={tool.d}></path>
                </svg>
              </div>
              <div data-shine style={{ marginTop: 14, fontSize: 14.5, fontWeight: 600, letterSpacing: "-.015em" }}>{t(`${tool.slug}.name`)}</div>
              <div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.45, color: "var(--cs-text-2)" }}>{t(`${tool.slug}.desc`)}</div>
            </Reveal>
          ))}
        </div>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            padding: 24,
            border: "1px solid var(--cs-accent-line)",
            borderRadius: 20,
            background: "var(--cs-accent-soft)",
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-.025em" }}>{t("cantFind")}</div>
            <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.55, color: "var(--cs-text-2)" }}>{t("aiSuggestion")}</div>
          </div>
          <Link
            href="/ai"
            className="hover-bg"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              borderRadius: 10,
              background: "var(--cs-accent)",
              color: "#fff",
              fontSize: 14.5,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t("askAI")} &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}

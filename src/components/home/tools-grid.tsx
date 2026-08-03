"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TOOLS, CATS } from "@/lib/data";
import { Reveal } from "@/components/reveal";

function toolHref(slug: string): string {
  return slug === "ocr" ? "/ai/ocr" : `/tools/${slug}`;
}

export function ToolsGrid() {
  const t = useTranslations("tools");
  const [cat, setCat] = useState("All");
  const shownTools = cat === "All" ? TOOLS : TOOLS.filter((tool) => tool.cat === cat);

  return (
    <section id="tools" style={{ borderTop: "1px solid var(--cs-line)", background: "var(--cs-bg-2)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(64px,8vw,104px) 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div>
            <Reveal as="h2" style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(45px,6.6vw,72px)", lineHeight: 1.06, letterSpacing: "-.035em" }}>
              {t("headline")}
            </Reveal>
            <p style={{ margin: "14px 0 0", maxWidth: 460, fontSize: 24, color: "var(--cs-text-2)" }}>
              {t("homeSubheadline")}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
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
                    fontSize: 19.5,
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
        </div>

        <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(248px,1fr))", gap: 12 }}>
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
                border: "1px solid var(--cs-tool-line)",
                borderRadius: "var(--cs-r)",
                background: "var(--cs-tool-bg)",
                color: "var(--cs-text)",
                cursor: "pointer",
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", display: "grid", placeItems: "center", color: "var(--cs-accent)" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={tool.d}></path>
                </svg>
              </div>
              <div data-shine style={{ marginTop: 14, fontSize: 21.75, fontWeight: 600, letterSpacing: "-.015em" }}>{t(`${tool.slug}.name`)}</div>
              <div style={{ marginTop: 5, fontSize: 19.5, lineHeight: 1.45, color: "var(--cs-text-2)" }}>{t(`${tool.slug}.desc`)}</div>
            </Reveal>
          ))}
        </div>
        <div style={{ marginTop: 32 }}>
          <Link href="/tools" style={{ fontSize: 21.75, fontWeight: 500, cursor: "pointer" }}>
            {t("viewAll")} &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

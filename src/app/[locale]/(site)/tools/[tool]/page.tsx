import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TOOL_REGISTRY, getToolConfig, getRelatedTools } from "@/lib/tools/registry";
import { GenericTool } from "@/components/tools/generic-tool";
import { SplitTool } from "@/components/tools/split/split-tool";
import { OrganizeTool } from "@/components/tools/organize/organize-tool";
import { RotateTool } from "@/components/tools/rotate/rotate-tool";
import { TOOLS } from "@/lib/data";

const CUSTOM_METADATA: Record<string, { title: string; description: string }> = {
  merge: {
    title: "Merge PDF Files Free Online — Claira Slate",
    description: "Combine multiple PDF files into one. Fast, free, no account required.",
  },
  compress: {
    title: "Compress PDF Free Online — Claira Slate",
    description: "Shrink a PDF's file size without losing readability. Fast, free, no account required.",
  },
};

export function generateStaticParams() {
  return TOOL_REGISTRY.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  const config = getToolConfig(tool);
  if (!config) return {};

  if (CUSTOM_METADATA[tool]) return CUSTOM_METADATA[tool];

  if (config.fallback) {
    return {
      title: `${config.fallback.name} Free Online — Claira Slate`,
      description: `${config.fallback.desc} Fast, free, no account required.`,
    };
  }

  const t = await getTranslations("tools");
  return {
    title: `${t(`${tool}.name`)} Free Online — Claira Slate`,
    description: `${t(`${tool}.desc`)} Fast, free, no account required.`,
  };
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const config = getToolConfig(tool);
  if (!config) notFound();

  const t = await getTranslations("tools");
  const tc = await getTranslations("common");
  const tp = await getTranslations("toolPage");
  const name = config.fallback?.name ?? t(`${tool}.name`);
  const desc = config.fallback?.desc ?? t(`${tool}.desc`);

  const related = getRelatedTools(tool, 4);
  const relatedWithIcons = related.map((r) => ({
    ...r,
    name: r.fallback?.name ?? t(`${r.slug}.name`),
    desc: r.fallback?.desc ?? t(`${r.slug}.desc`),
    d: TOOLS.find((x) => x.slug === r.slug)?.d,
  }));

  const isSplit = tool === "split";
  const isOrganize = tool === "reorder";
  const isRotate = tool === "rotate";

  return (
    <div style={{ animation: "csFade .28s ease both" }}>
      <div style={{ maxWidth: isSplit || isOrganize || isRotate ? 1400 : 1100, margin: "0 auto", padding: "clamp(32px,4vw,52px) clamp(20px,3vw,40px) 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
          <Link href="/" className="hover-text" style={{ cursor: "pointer", color: "var(--cs-text-2)" }}>{tc("breadcrumb.home")}</Link>
          <span style={{ color: "var(--cs-line)" }}>/</span>
          <Link href="/tools" className="hover-text" style={{ cursor: "pointer", color: "var(--cs-text-2)" }}>{tc("breadcrumb.tools")}</Link>
          <span style={{ color: "var(--cs-line)" }}>/</span>
          <span style={{ color: "var(--cs-text)" }}>{name}</span>
        </div>
        <div style={{ marginTop: "clamp(28px,3.5vw,44px)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 20 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-geist), Inter, sans-serif",
              fontWeight: 600,
              fontSize: "clamp(34px,5vw,56px)",
              lineHeight: 1.04,
              letterSpacing: "-.04em",
            }}
          >
            {name}
          </h1>
          <p style={{ margin: 0, maxWidth: 520, fontSize: "clamp(15px,1.4vw,18px)", lineHeight: 1.6, color: "var(--cs-text-2)", textWrap: "pretty" }}>
            {desc}
          </p>
        </div>

        <div style={{ marginTop: 36 }}>
          {isSplit ? (
            <SplitTool />
          ) : isOrganize ? (
            <OrganizeTool />
          ) : isRotate ? (
            <RotateTool />
          ) : (
            <div className="tool-workspace">
              <GenericTool config={config} />
            </div>
          )}
        </div>

        {relatedWithIcons.length > 0 && (
          <div style={{ marginTop: "clamp(48px,6vw,72px)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text-2)", marginBottom: 16 }}>{tp("continueTo")}</div>
            <div className="tool-related-grid">
              {relatedWithIcons.map((r) => (
                <Link key={r.slug} href={`/tools/${r.slug}`} className="tool-related-card">
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--cs-accent-soft)", border: "1px solid var(--cs-accent-line)", display: "grid", placeItems: "center", color: "var(--cs-accent)", flex: "none" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      {r.d && <path d={r.d}></path>}
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--cs-text-2)", lineHeight: 1.4 }}>{r.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

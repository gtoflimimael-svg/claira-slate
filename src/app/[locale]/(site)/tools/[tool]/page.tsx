import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TOOL_REGISTRY, getToolConfig } from "@/lib/tools/registry";
import { GenericTool } from "@/components/tools/generic-tool";

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
  const name = config.fallback?.name ?? t(`${tool}.name`);
  const desc = config.fallback?.desc ?? t(`${tool}.desc`);

  return (
    <div style={{ animation: "csFade .28s ease both" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(32px,4vw,52px) clamp(20px,3vw,40px) 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
          <Link href="/" className="hover-text" style={{ cursor: "pointer", color: "var(--cs-text-2)" }}>Home</Link>
          <span style={{ color: "var(--cs-line)" }}>/</span>
          <Link href="/tools" className="hover-text" style={{ cursor: "pointer", color: "var(--cs-text-2)" }}>Tools</Link>
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

        <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr", gap: 18, maxWidth: 640 }}>
          <GenericTool config={config} />
        </div>
      </div>
    </div>
  );
}

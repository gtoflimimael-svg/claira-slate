import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TOOL_REGISTRY, getToolConfig, getRelatedTools } from "@/lib/tools/registry";
import { GenericTool } from "@/components/tools/generic-tool";
import { SplitTool } from "@/components/tools/split/split-tool";
import { OrganizeTool } from "@/components/tools/organize/organize-tool";
import { RotateTool } from "@/components/tools/rotate/rotate-tool";
import { ExtractTool } from "@/components/tools/extract/extract-tool";
import { DeleteTool } from "@/components/tools/delete/delete-tool";
import { CompressTool } from "@/components/tools/compress/compress-tool";
import { RepairTool } from "@/components/tools/repair/repair-tool";
import { OptimizeTool } from "@/components/tools/optimize/optimize-tool";
import { FlattenTool } from "@/components/tools/flatten/flatten-tool";
import { GrayscaleTool } from "@/components/tools/grayscale/grayscale-tool";
import { PdfToWordTool } from "@/components/tools/pdf-to-word/pdf-to-word-tool";
import { PdfToExcelTool } from "@/components/tools/pdf-to-excel/pdf-to-excel-tool";
import { PdfToPptTool } from "@/components/tools/pdf-to-ppt/pdf-to-ppt-tool";
import { WordToPdfTool } from "@/components/tools/word-to-pdf/word-to-pdf-tool";
import { ExcelToPdfTool } from "@/components/tools/excel-to-pdf/excel-to-pdf-tool";
import { PptToPdfTool } from "@/components/tools/ppt-to-pdf/ppt-to-pdf-tool";
import { JpgToPdfTool } from "@/components/tools/jpg-to-pdf/jpg-to-pdf-tool";
import { HtmlToPdfTool } from "@/components/tools/html-to-pdf/html-to-pdf-tool";
import { ProtectTool } from "@/components/tools/protect/protect-tool";
import { UnlockTool } from "@/components/tools/unlock/unlock-tool";
import { RedactTool } from "@/components/tools/redact/redact-tool";
import { CertifyTool } from "@/components/tools/certify/certify-tool";
import { SignTool } from "@/components/tools/sign/sign-tool";
import { WatermarkTool } from "@/components/tools/watermark/watermark-tool";
import { NumberPagesTool } from "@/components/tools/number-pages/number-pages-tool";
import { HeaderFooterTool } from "@/components/tools/header-footer/header-footer-tool";
import { CropTool } from "@/components/tools/crop/crop-tool";
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
  const isExtract = tool === "extract-pages";
  const isDelete = tool === "delete-pages";
  const isCompress = tool === "compress";
  const isRepair = tool === "repair";
  const isOptimize = tool === "optimize";
  const isFlatten = tool === "flatten";
  const isGrayscale = tool === "grayscale";
  const isPdfToWord = tool === "pdf-to-word";
  const isPdfToExcel = tool === "pdf-to-excel";
  const isPdfToPpt = tool === "pdf-to-ppt";
  const isWordToPdf = tool === "word-to-pdf";
  const isExcelToPdf = tool === "excel-to-pdf";
  const isPptToPdf = tool === "ppt-to-pdf";
  const isJpgToPdf = tool === "jpg-to-pdf";
  const isHtmlToPdf = tool === "html-to-pdf";
  const isProtect = tool === "protect";
  const isUnlock = tool === "unlock";
  const isRedact = tool === "redact";
  const isCertify = tool === "certify";
  const isSign = tool === "sign";
  const isWatermark = tool === "watermark";
  const isNumberPages = tool === "number-pages";
  const isHeaderFooter = tool === "header-footer";
  const isCrop = tool === "crop";
  const usesWideLayout =
    isSplit ||
    isOrganize ||
    isRotate ||
    isExtract ||
    isDelete ||
    isCompress ||
    isRepair ||
    isOptimize ||
    isFlatten ||
    isGrayscale ||
    isPdfToWord ||
    isPdfToExcel ||
    isPdfToPpt ||
    isWordToPdf ||
    isExcelToPdf ||
    isPptToPdf ||
    isJpgToPdf ||
    isHtmlToPdf ||
    isProtect ||
    isUnlock ||
    isRedact ||
    isCertify ||
    isSign ||
    isWatermark ||
    isNumberPages ||
    isHeaderFooter ||
    isCrop;

  return (
    <div style={{ animation: "csFade .28s ease both" }}>
      <div style={{ maxWidth: usesWideLayout ? 1400 : 1100, margin: "0 auto", padding: "clamp(32px,4vw,52px) clamp(20px,3vw,40px) 0" }}>
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
          ) : isExtract ? (
            <ExtractTool />
          ) : isDelete ? (
            <DeleteTool />
          ) : isCompress ? (
            <CompressTool />
          ) : isRepair ? (
            <RepairTool />
          ) : isOptimize ? (
            <OptimizeTool />
          ) : isFlatten ? (
            <FlattenTool />
          ) : isGrayscale ? (
            <GrayscaleTool />
          ) : isPdfToWord ? (
            <PdfToWordTool />
          ) : isPdfToExcel ? (
            <PdfToExcelTool />
          ) : isPdfToPpt ? (
            <PdfToPptTool />
          ) : isWordToPdf ? (
            <WordToPdfTool />
          ) : isExcelToPdf ? (
            <ExcelToPdfTool />
          ) : isPptToPdf ? (
            <PptToPdfTool />
          ) : isJpgToPdf ? (
            <JpgToPdfTool />
          ) : isHtmlToPdf ? (
            <HtmlToPdfTool />
          ) : isProtect ? (
            <ProtectTool />
          ) : isUnlock ? (
            <UnlockTool />
          ) : isRedact ? (
            <RedactTool />
          ) : isCertify ? (
            <CertifyTool />
          ) : isSign ? (
            <SignTool />
          ) : isWatermark ? (
            <WatermarkTool />
          ) : isNumberPages ? (
            <NumberPagesTool />
          ) : isHeaderFooter ? (
            <HeaderFooterTool />
          ) : isCrop ? (
            <CropTool />
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

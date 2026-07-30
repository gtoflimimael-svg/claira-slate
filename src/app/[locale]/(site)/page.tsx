import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { ToolsGrid } from "@/components/home/tools-grid";
import { AiFeatures } from "@/components/home/ai-features";
import { HowItWorks } from "@/components/home/how-it-works";
import { PricingTeaser } from "@/components/home/pricing-teaser";
import { SocialProof } from "@/components/home/social-proof";
import { FinalCta } from "@/components/home/final-cta";

export const metadata: Metadata = {
  title: "Claira Slate — Every PDF tool. Now with AI.",
  description:
    "Merge, compress, convert and understand your PDFs with AI. Free to start, no account required.",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Claira Slate",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Merge, compress, convert and understand your PDFs — all in one place. 26 free tools, no account required, no watermarks, AI included.",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "5", priceCurrency: "USD" },
    { "@type": "Offer", name: "Business", price: "12", priceCurrency: "USD" },
  ],
};

export default function HomePage() {
  return (
    <div style={{ animation: "csFade .28s ease both" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Hero />
      <ToolsGrid />
      <AiFeatures />
      <HowItWorks />
      <PricingTeaser />
      <SocialProof />
      <FinalCta />
    </div>
  );
}

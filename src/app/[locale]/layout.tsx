import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { routing, RTL_LOCALES } from "@/i18n/routing";
import "../globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DEFAULT_DESCRIPTION =
  "Merge, compress, convert and understand your PDFs with AI. Free to start, no account required.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Claira Slate — Every PDF tool. Now with AI.",
  description: DEFAULT_DESCRIPTION,
  icons: {
    icon: "/uploads/claira-slate-lettermark.svg",
  },
  openGraph: {
    type: "website",
    siteName: "Claira Slate",
    title: "Claira Slate — Every PDF tool. Now with AI.",
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/uploads/claira-slate-lettermark.svg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Claira Slate — Every PDF tool. Now with AI.",
    description: DEFAULT_DESCRIPTION,
    images: ["/uploads/claira-slate-lettermark.svg"],
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"} className={`${geist.variable} ${inter.variable}`}>
      <head>
        <style>{`html { zoom: 1.75 !important; }`}</style>
      </head>
      <body>
        <AnalyticsProvider />
        <NextIntlClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

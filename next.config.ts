import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // These ship native binaries / worker scripts that break when bundled by
  // Turbopack/webpack — run them via native Node `require` instead.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "tesseract.js", "sharp"],
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

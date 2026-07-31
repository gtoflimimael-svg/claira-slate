import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // These ship native binaries / worker scripts that break when bundled by
  // Turbopack/webpack — run them via native Node `require` instead.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "tesseract.js", "sharp"],
  // pdf-parse's bundled pdfjs-dist conditionally requires @napi-rs/canvas at
  // runtime for page rendering; Vercel's file tracer doesn't follow that
  // conditional require, so the native binary gets dropped from the deployed
  // function and every route that touches pdf-parse 500s with
  // "ReferenceError: DOMMatrix is not defined". Force it into every trace.
  outputFileTracingIncludes: {
    "/api/tools/\\[tool\\]": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "./node_modules/pdf-parse/**/*",
    ],
    "/api/ai/extract-text": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "./node_modules/pdf-parse/**/*",
    ],
    "/api/ai/ocr": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "./node_modules/pdf-parse/**/*",
    ],
    "/api/ai/summarize": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "./node_modules/pdf-parse/**/*",
    ],
    "/api/ai/translate": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "./node_modules/pdf-parse/**/*",
    ],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

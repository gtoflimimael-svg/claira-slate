import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/data";
import { TOOL_REGISTRY } from "@/lib/tools/registry";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const STATIC_ROUTES = [
  "",
  "/about",
  "/contact",
  "/pricing",
  "/tools",
  "/ai",
  "/ai/summarize",
  "/ai/chat",
  "/ai/translate",
  "/ai/ocr",
  "/blog",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));

  const postEntries: MetadataRoute.Sitemap = POSTS.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(),
  }));

  const toolEntries: MetadataRoute.Sitemap = TOOL_REGISTRY.map((tool) => ({
    url: `${SITE_URL}/tools/${tool.slug}`,
    lastModified: new Date(),
  }));

  return [...staticEntries, ...postEntries, ...toolEntries];
}

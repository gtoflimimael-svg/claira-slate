import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — Notes on documents — Claira Slate",
  description: "Product notes, engineering deep-dives and guides on getting more out of your PDFs.",
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}

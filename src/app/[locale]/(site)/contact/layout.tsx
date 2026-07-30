import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — Claira Slate",
  description: "Get in touch with support, sales or security.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

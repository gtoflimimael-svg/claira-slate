import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in — Claira Slate",
  description: "Log in to your Claira Slate account.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

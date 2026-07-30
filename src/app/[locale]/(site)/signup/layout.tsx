import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up free — Claira Slate",
  description: "Create a free Claira Slate account. No credit card required.",
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}

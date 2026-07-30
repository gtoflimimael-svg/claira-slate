import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset your password — Claira Slate",
  description: "Request a password reset link for your Claira Slate account.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

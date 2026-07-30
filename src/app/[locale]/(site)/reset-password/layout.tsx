import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set a new password — Claira Slate",
  description: "Choose a new password for your Claira Slate account.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

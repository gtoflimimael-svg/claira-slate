import { Body, Container, Head, Hr, Html, Img, Preview, Text } from "@react-email/components";
import type { ReactNode } from "react";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ACCENT = "#6C63FF";

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f4f4f7", fontFamily: "-apple-system, Helvetica, Arial, sans-serif", padding: "40px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "36px 40px", maxWidth: 480 }}>
          <Img
            src={`${SITE_URL}/uploads/claira-slate-lettermark.svg`}
            width="32"
            height="32"
            alt="Claira Slate"
            style={{ marginBottom: 24 }}
          />
          {children}
          <Hr style={{ borderColor: "#e6e6eb", margin: "32px 0 20px" }} />
          <Text style={{ fontSize: 12, color: "#8a8a94", margin: 0 }}>
            Claira Slate — every PDF tool, now with AI.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  accent: ACCENT,
  heading: { fontSize: 22, fontWeight: 600, color: "#16161a", margin: "0 0 16px", letterSpacing: "-0.02em" },
  text: { fontSize: 15, lineHeight: 1.6, color: "#4a4a55", margin: "0 0 16px" },
  button: {
    display: "inline-block" as const,
    backgroundColor: ACCENT,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 600,
    padding: "12px 24px",
    borderRadius: 10,
    textDecoration: "none",
  },
  notice: { fontSize: 13, color: "#8a8a94", margin: "16px 0 0" },
};

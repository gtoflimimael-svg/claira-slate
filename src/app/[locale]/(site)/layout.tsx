import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--cs-bg)", color: "var(--cs-text)", fontSize: 16, lineHeight: 1.5, overflowX: "hidden" }}>
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

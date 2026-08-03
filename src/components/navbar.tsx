"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";

const NAV_LINKS: { key: "tools" | "ai" | "pricing" | "blog"; href: string; match: (p: string) => boolean }[] = [
  { key: "tools", href: "/tools", match: (p) => p.startsWith("/tools") },
  { key: "ai", href: "/ai", match: (p) => p.startsWith("/ai") },
  { key: "pricing", href: "/pricing", match: (p) => p === "/pricing" },
  { key: "blog", href: "/blog", match: (p) => p.startsWith("/blog") },
];

export function Navbar() {
  const navRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const t = useTranslations("navbar");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById("top") || document.getElementById("aitop");
      const trigger = hero ? Math.max(120, hero.offsetHeight * 0.55) : 6;
      const on = (window.scrollY || document.documentElement.scrollTop) > trigger;
      setScrolled(on);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        background: scrolled ? "color-mix(in oklab, var(--cs-bg) 80%, transparent)" : "transparent",
        backdropFilter: scrolled ? "saturate(180%) blur(14px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--cs-line)" : "transparent"}`,
        transition: "background .2s ease,border-color .2s ease",
      }}
    >
      <div
        data-navrow
        style={{
          padding: "0 24px",
          height: 68,
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <Link href="/" aria-label="Claira Slate" style={{ display: "flex", alignItems: "center", lineHeight: 0, cursor: "pointer" }}>
          <Logo size={56} />
        </Link>
        <div data-navlinks style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 auto" }}>
          {NAV_LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.key}
                href={l.href}
                data-underline
                className="hover-text"
                style={{
                  position: "relative",
                  padding: "7px 12px",
                  borderRadius: 8,
                  fontSize: 24.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  color: active ? "var(--cs-text)" : "var(--cs-text-2)",
                }}
              >
                {t(l.key)}
                {active && (
                  <span
                    style={{
                      position: "absolute",
                      left: 12,
                      right: 12,
                      bottom: -1,
                      height: 2,
                      borderRadius: 2,
                      background: "var(--cs-accent)",
                    }}
                  ></span>
                )}
              </Link>
            );
          })}
        </div>
        <div data-navcta style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <ThemeToggle />
          <LanguageSwitcher direction="down" />
          <Link
            data-navghost
            href="/login"
            className="hover-bg"
            style={{ padding: "9px 14px", borderRadius: 8, fontSize: 24.5, fontWeight: 500, color: "var(--cs-text)", cursor: "pointer" }}
          >
            {t("login")}
          </Link>
          <Link
            data-press
            href="/signup"
            style={{
              padding: "9px 15px",
              borderRadius: 8,
              fontSize: 24.5,
              fontWeight: 500,
              background: "var(--cs-grad)",
              color: "#fff",
              cursor: "pointer",
              whiteSpace: "nowrap",
              animation: "csGlow 4s ease-in-out infinite",
            }}
          >
            {t("getStarted")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

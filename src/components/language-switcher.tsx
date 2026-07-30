"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { LANGS } from "@/lib/data";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher({ direction = "down" }: { direction?: "down" | "up" }) {
  const locale = useLocale();
  const lang = LANGS.find((l) => l.code === locale) ?? LANGS[0];
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  function setLang(code: string) {
    startTransition(() => {
      router.replace(pathname, { locale: code });
    });
  }

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="hover-border"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "8px 11px",
          border: "1px solid var(--cs-line)",
          borderRadius: 8,
          background: "transparent",
          color: "var(--cs-text)",
          fontFamily: "Inter, sans-serif",
          fontSize: 13.5,
          fontWeight: 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ flex: "none" }}>
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M3.6 9h16.8M3.6 15h16.8M12 3c-4 4.5-4 13.5 0 18M12 3c4 4.5 4 13.5 0 18"></path>
        </svg>
        {lang.name}
        <span style={{ fontSize: 10, color: "var(--cs-text-2)" }}>&#9662;</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            [direction === "down" ? "top" : "bottom"]: "calc(100% + 8px)",
            right: direction === "down" ? 0 : "auto",
            left: direction === "down" ? "auto" : 0,
            zIndex: 80,
            width: 216,
            maxHeight: direction === "down" ? 420 : 300,
            overflowY: "auto",
            overflowX: "hidden",
            padding: 6,
            border: "1px solid var(--cs-line)",
            borderRadius: 8,
            background: "var(--cs-card)",
            animation: "csDrop .15s ease both",
          }}
        >
          {LANGS.map((l) => {
            const active = l.code === lang.code;
            return (
              <button
                key={l.code}
                onClick={(e) => {
                  e.stopPropagation();
                  setLang(l.code);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "8px 10px",
                  border: 0,
                  borderRadius: 6,
                  background: "transparent",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13.5,
                  textAlign: "left",
                  cursor: "pointer",
                  color: active ? "var(--cs-accent)" : "var(--cs-text)",
                  fontWeight: active ? 600 : 500,
                }}
                className="hover-accent"
              >
                <span style={{ flex: "none", width: 14, display: "grid", placeItems: "center" }}>
                  {active && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cs-accent)" strokeWidth="2.6" strokeLinecap="round">
                      <path d="M4 12.5l5 5L20 6.5"></path>
                    </svg>
                  )}
                </span>
                <span style={{ flex: "1 1 auto" }}>{l.name}</span>
                {l.rtl && (
                  <span
                    style={{
                      flex: "none",
                      padding: "2px 6px",
                      borderRadius: 5,
                      background: "var(--cs-bg-2)",
                      fontSize: 9.5,
                      fontWeight: 600,
                      letterSpacing: ".04em",
                      color: "var(--cs-text-2)",
                    }}
                  >
                    RTL
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

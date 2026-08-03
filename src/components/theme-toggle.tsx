"use client";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { dark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className="hover-text hover-border"
      style={{
        width: 59.5,
        height: 59.5,
        display: "grid",
        placeItems: "center",
        border: "1px solid var(--cs-line)",
        background: "transparent",
        borderRadius: 8,
        color: "var(--cs-text-2)",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {dark ? (
        <svg width="26.25" height="26.25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"></path>
        </svg>
      ) : (
        <svg width="26.25" height="26.25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"></path>
        </svg>
      )}
    </button>
  );
}

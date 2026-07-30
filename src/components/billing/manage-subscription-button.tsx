"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";

export function ManageSubscriptionButton({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();

      if (res.status === 401 && data.redirect) {
        router.push(data.redirect);
        return;
      }
      if (!res.ok || !data.url) {
        setError(data.error || "Couldn't open the billing portal.");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
        style={{ ...style, cursor: loading ? "default" : style?.cursor ?? "pointer", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Opening…" : children}
      </button>
      {error && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--cs-bad)" }}>{error}</div>}
    </>
  );
}

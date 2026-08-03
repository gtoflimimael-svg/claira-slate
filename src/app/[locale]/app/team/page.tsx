"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TEAM } from "@/lib/data";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("");
}

export default function TeamPage() {
  const t = useTranslations("dashboard.team_");
  const tc = useTranslations("common");
  const [inviteOpen, setInviteOpen] = useState(false);

  function statusStyle(active: boolean) {
    return {
      fg: active ? "var(--cs-ok)" : "var(--cs-accent)",
      bg: active ? "color-mix(in oklab, var(--cs-ok) 12%, var(--cs-bg))" : "var(--cs-accent-soft)",
      label: active ? t("active") : t("invited"),
    };
  }

  const STATS = [
    { key: "seatsUsed", value: "5 / 10", bar: 50 },
    { key: "documentsTeam", value: "1,842", note: t("thisMonth") },
    { key: "pendingInvites", value: "1", note: t("expiresInDays", { days: 6 }) },
    { key: "sso", value: t("active"), note: t("ssoDetail"), valueColor: "var(--cs-ok)" },
  ];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(42px,5.25vw,59.5px)", lineHeight: 1.1, letterSpacing: "-.035em" }}>{t("title")}</h1>
          <p style={{ margin: "8px 0 0", fontSize: 25.38, color: "var(--cs-text-2)" }}>{t("subtitle")}</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          style={{ padding: "11px 18px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 24.5, fontWeight: 500, cursor: "pointer", border: 0 }}
        >
          {t("inviteMember")}
        </button>
      </div>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(200px,100%),1fr))", gap: 12 }}>
        {STATS.map((s) => (
          <div key={s.key} style={{ padding: 20, border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-bg)" }}>
            <div style={{ fontSize: 21, fontWeight: 500, color: "var(--cs-text-2)" }}>{t(s.key)}</div>
            <div style={{ marginTop: 10, fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 49, fontWeight: 600, letterSpacing: "-.04em", color: s.valueColor }}>{s.value}</div>
            {s.bar !== undefined ? (
              <div style={{ marginTop: 10, height: 5, borderRadius: 99, background: "var(--cs-line)", overflow: "hidden" }}>
                <div style={{ width: `${s.bar}%`, height: "100%", borderRadius: 99, background: "var(--cs-grad)" }} />
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 21, color: "var(--cs-text-2)" }}>{s.note}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)", overflowX: "auto" }}>
        <div style={{ minWidth: 620 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 2fr 1fr 1fr .6fr",
              padding: "14px 20px",
              borderBottom: "1px solid var(--cs-line)",
              fontSize: 20.12,
              fontWeight: 600,
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--cs-text-2)",
            }}
          >
            <div>{t("colMember")}</div>
            <div>{t("colEmail")}</div>
            <div>{t("colRole")}</div>
            <div>{t("colStatus")}</div>
            <div></div>
          </div>
          {TEAM.map((m) => {
            const s = statusStyle(m.active);
            return (
              <div key={m.email} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr .6fr", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--cs-line)", fontSize: 23.62 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <div
                    style={{
                      flex: "none",
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "var(--cs-accent-soft)",
                      border: "1px solid var(--cs-accent-line)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 20.12,
                      fontWeight: 600,
                      color: "var(--cs-accent)",
                    }}
                  >
                    {initials(m.name)}
                  </div>
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                </div>
                <div style={{ color: "var(--cs-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
                <div style={{ color: "var(--cs-text-2)" }}>{m.role}</div>
                <div>
                  <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 19.25, fontWeight: 500, background: s.bg, color: s.fg }}>{s.label}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 26.25, color: "var(--cs-text-2)", cursor: "pointer" }}>&hellip;</span>
                </div>
              </div>
            );
          })}
          <div style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 21.88, color: "var(--cs-text-2)" }}>
            <span>{t("permissionsNote")}</span>
            <Link href="/app/settings" style={{ fontWeight: 500, cursor: "pointer" }}>
              {t("rolePermissions")} &rarr;
            </Link>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: 22,
          border: "1px solid var(--cs-line)",
          borderRadius: 20,
          background: "var(--cs-bg)",
        }}
      >
        <div>
          <div style={{ fontSize: 22.75, fontWeight: 600 }}>{t("teamBilling")}</div>
          <div style={{ marginTop: 7, fontSize: 24.5, color: "var(--cs-text-2)" }}>
            {t("billingSummary")}
          </div>
        </div>
        <Link href="/app/billing" className="hover-border" style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 24.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
          {t("manageBilling")} &rarr;
        </Link>
      </div>

      {inviteOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(17,17,17,.45)" }}>
          <div onClick={() => setInviteOpen(false)} style={{ position: "absolute", inset: 0, cursor: "pointer" }}></div>
          <div style={{ position: "relative", width: "100%", maxWidth: 420, padding: "clamp(22px,3vw,28px)", border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 33.25, fontWeight: 600, letterSpacing: "-.025em" }}>{t("inviteModalTitle")}</div>
                <div style={{ marginTop: 7, fontSize: 23.62, lineHeight: 1.55, color: "var(--cs-text-2)" }}>{t("inviteModalBody")}</div>
              </div>
              <button
                onClick={() => setInviteOpen(false)}
                aria-label={tc("close")}
                className="hover-bg"
                style={{ flex: "none", width: 28, height: 28, display: "grid", placeItems: "center", border: 0, borderRadius: 8, background: "transparent", color: "var(--cs-text-2)", fontSize: 29.75, lineHeight: 1, cursor: "pointer", padding: 0 }}
              >
                &times;
              </button>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 15 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 22.75, fontWeight: 500, color: "var(--cs-text-2)" }}>
                {t("emailAddress")}
                <input
                  type="email"
                  placeholder="name@northwind.co"
                  style={{ padding: "12px 14px", border: "1px solid var(--cs-line)", borderRadius: 10, background: "var(--cs-bg-2)", color: "var(--cs-text)", fontFamily: "Inter, sans-serif", fontSize: 24.5, outline: "none" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 22.75, fontWeight: 500, color: "var(--cs-text-2)" }}>
                {t("role")}
                <select style={{ padding: "12px 14px", border: "1px solid var(--cs-line)", borderRadius: 10, background: "var(--cs-bg-2)", color: "var(--cs-text)", fontFamily: "Inter, sans-serif", fontSize: 24.5, outline: "none" }}>
                  <option>{t("roleMember")}</option>
                  <option>{t("roleAdmin")}</option>
                  <option>{t("roleViewer")}</option>
                </select>
              </label>
              <div style={{ display: "flex", gap: 9, marginTop: 4 }}>
                <button
                  onClick={() => setInviteOpen(false)}
                  style={{ flex: "1 1 0", textAlign: "center", padding: 12, borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 24.5, fontWeight: 600, cursor: "pointer", border: 0 }}
                >
                  {t("sendInvite")}
                </button>
                <button
                  onClick={() => setInviteOpen(false)}
                  className="hover-border"
                  style={{ flex: "0 0 auto", padding: "12px 18px", borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 24.5, fontWeight: 500, cursor: "pointer", background: "none" }}
                >
                  {tc("cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

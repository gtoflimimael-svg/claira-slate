"use client";

import { useState } from "react";
import { useTheme } from "@/components/theme-provider";

export default function SettingsPage() {
  const { dark, toggleTheme } = useTheme();
  const [keepFiles, setKeepFiles] = useState(true);
  const [emailReceipts, setEmailReceipts] = useState(true);
  const [productEmails, setProductEmails] = useState(false);

  return (
    <div>
      <h1 style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(24px,3vw,34px)", lineHeight: 1.1, letterSpacing: "-.035em" }}>Settings</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "var(--cs-text-2)" }}>Your profile, defaults and privacy controls.</p>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))", gap: 14, alignItems: "start" }}>
        <div style={{ padding: 24, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Profile</div>
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                flex: "none",
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "var(--cs-accent-soft)",
                border: "1px solid var(--cs-accent-line)",
                display: "grid",
                placeItems: "center",
                fontSize: 16,
                fontWeight: 600,
                color: "var(--cs-accent)",
              }}
            >
              MR
            </div>
            <button className="hover-border" style={{ padding: "9px 15px", borderRadius: 9, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 13, fontWeight: 500, cursor: "pointer", background: "none" }}>
              Change photo
            </button>
          </div>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 500, color: "var(--cs-text-2)" }}>
              Full name
              <input
                type="text"
                defaultValue="Maya Rendel"
                style={{ padding: "11px 14px", border: "1px solid var(--cs-line)", borderRadius: 10, background: "var(--cs-bg-2)", color: "var(--cs-text)", fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 500, color: "var(--cs-text-2)" }}>
              Email
              <input
                type="email"
                defaultValue="maya@northwind.co"
                style={{ padding: "11px 14px", border: "1px solid var(--cs-line)", borderRadius: 10, background: "var(--cs-bg-2)", color: "var(--cs-text)", fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 500, color: "var(--cs-text-2)" }}>
              Default OCR language
              <select style={{ padding: "11px 14px", border: "1px solid var(--cs-line)", borderRadius: 10, background: "var(--cs-bg-2)", color: "var(--cs-text)", fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none" }}>
                <option>English</option>
                <option>Nederlands</option>
                <option>Français</option>
                <option>Deutsch</option>
              </select>
            </label>
            <button
              style={{ marginTop: 4, display: "inline-block", padding: "11px 18px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14, fontWeight: 500, textAlign: "center", cursor: "pointer", border: 0 }}
            >
              Save changes
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: 24, border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-bg)" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Preferences</div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Dark mode</div>
                  <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--cs-text-2)" }}>Follows this switch, not your system.</div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="hover-accent hover-border"
                  style={{
                    flex: "none",
                    width: 60,
                    padding: "9px 0",
                    border: "1px solid var(--cs-line)",
                    borderRadius: 99,
                    background: "var(--cs-bg-2)",
                    color: "var(--cs-text)",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {dark ? "On" : "Off"}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Keep finished files</div>
                  <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--cs-text-2)" }}>Pro only. Off means deleted after one hour.</div>
                </div>
                <label style={{ flex: "none" }}>
                  <input type="checkbox" checked={keepFiles} onChange={(e) => setKeepFiles(e.target.checked)} style={{ width: 17, height: 17, accentColor: "var(--cs-accent)" }} />
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Email receipts</div>
                  <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--cs-text-2)" }}>Monthly invoice to your billing address.</div>
                </div>
                <label style={{ flex: "none" }}>
                  <input type="checkbox" checked={emailReceipts} onChange={(e) => setEmailReceipts(e.target.checked)} style={{ width: 17, height: 17, accentColor: "var(--cs-accent)" }} />
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Product emails</div>
                  <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--cs-text-2)" }}>Roughly one message a quarter.</div>
                </div>
                <label style={{ flex: "none" }}>
                  <input type="checkbox" checked={productEmails} onChange={(e) => setProductEmails(e.target.checked)} style={{ width: 17, height: 17, accentColor: "var(--cs-accent)" }} />
                </label>
              </div>
            </div>
          </div>

          <div style={{ padding: 24, border: "1px solid color-mix(in oklab, var(--cs-bad) 32%, var(--cs-bg))", borderRadius: 20, background: "var(--cs-bg)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-bad)" }}>Danger zone</div>
            <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
              Deleting your account removes every stored file and the billing history immediately. This cannot be undone.
            </div>
            <button
              style={{
                marginTop: 18,
                display: "inline-block",
                padding: "10px 16px",
                borderRadius: 9,
                border: "1px solid color-mix(in oklab, var(--cs-bad) 40%, var(--cs-bg))",
                color: "var(--cs-bad)",
                fontSize: 13.5,
                fontWeight: 500,
                cursor: "pointer",
                background: "none",
              }}
            >
              Delete account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

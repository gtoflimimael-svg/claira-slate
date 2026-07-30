"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

const CHANNELS = [
  {
    icon: <path d="M3 6h18v12H3zM3 7l9 6 9-6"></path>,
    title: "Support",
    detail: "help@clairaslate.com · replies within a day",
  },
  {
    icon: <path d="M16 20v-2a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v2M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a3 3 0 0 0-2.3-2.9"></path>,
    title: "Sales & Business plans",
    detail: "sales@clairaslate.com · SSO, DPA, invoicing",
  },
  {
    icon: <path d="M12 3l8 3v6c0 5-3.5 7.7-8 9-4.5-1.3-8-4-8-9V6z"></path>,
    title: "Security disclosure",
    detail: "security@clairaslate.com · PGP key on request",
  },
];

const fieldLabel: CSSProperties = { display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 500, color: "var(--cs-text-2)" };
const fieldInput: CSSProperties = {
  padding: "12px 14px",
  border: "1px solid var(--cs-line)",
  borderRadius: 10,
  background: "var(--cs-bg)",
  color: "var(--cs-text)",
  fontFamily: "Inter, sans-serif",
  fontSize: 14,
  outline: "none",
};

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("A Business plan quote");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email and a message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("That email address doesn't look right.");
      return;
    }
    setError("");
    setSent(true);
  }

  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,8vw,104px) 24px clamp(56px,7vw,96px)" }}>
      <style>{`.cs-field:focus{border-color:var(--cs-accent)}`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "start" }}>
        <div>
          <h1
            style={{
              margin: 0,
              maxWidth: 460,
              fontFamily: "var(--font-geist), Inter, sans-serif",
              fontWeight: 600,
              fontSize: "clamp(34px,5vw,54px)",
              lineHeight: 1.04,
              letterSpacing: "-.042em",
            }}
          >
            Talk to a human.
          </h1>
          <p style={{ margin: "20px 0 0", maxWidth: 420, fontSize: 16, lineHeight: 1.65, color: "var(--cs-text-2)" }}>
            Sales, security reviews, invoicing or a bug you want fixed — it all reaches the same small team.
          </p>
          <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 12 }}>
            {CHANNELS.map((c) => (
              <div key={c.title} style={{ display: "flex", gap: 13, padding: 18, border: "1px solid var(--cs-line)", borderRadius: "var(--cs-r)", background: "var(--cs-card)" }}>
                <div
                  style={{
                    flex: "none",
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: "var(--cs-accent-soft)",
                    border: "1px solid var(--cs-accent-line)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--cs-accent)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    {c.icon}
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div>
                  <div style={{ marginTop: 4, fontSize: 13.5, color: "var(--cs-text-2)" }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "clamp(24px,3vw,32px)", border: "1px solid var(--cs-line)", borderRadius: 20, background: "var(--cs-card)" }}>
          {sent ? (
            <div style={{ padding: "20px 0", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: "-.025em" }}>Message sent</div>
              <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--cs-text-2)" }}>
                Thanks, {name.split(" ")[0] || "there"} — we reply from a real address, usually within a day.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: "-.025em" }}>Send a message</div>
              <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 16 }}>
                <label style={fieldLabel}>
                  Name
                  <input className="cs-field" type="text" placeholder="Maya Rendel" style={fieldInput} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label style={fieldLabel}>
                  Work email
                  <input className="cs-field" type="email" placeholder="you@company.com" style={fieldInput} value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label style={fieldLabel}>
                  What do you need?
                  <select className="cs-field" style={fieldInput} value={topic} onChange={(e) => setTopic(e.target.value)}>
                    <option>A Business plan quote</option>
                    <option>Security review / DPA</option>
                    <option>Help with a file</option>
                    <option>Something else</option>
                  </select>
                </label>
                <label style={fieldLabel}>
                  Message
                  <textarea
                    className="cs-field"
                    rows={4}
                    placeholder="Tell us a little about the documents you work with."
                    style={{ ...fieldInput, resize: "vertical" }}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                {error && <div style={{ fontSize: 13, color: "var(--cs-bad)" }}>{error}</div>}
                <button
                  type="submit"
                  className="hover-bg"
                  style={{ display: "block", textAlign: "center", padding: 13, border: "none", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}
                >
                  Send message
                </button>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--cs-text-2)" }}>We reply from a real address. No sequences, no drip campaigns.</div>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

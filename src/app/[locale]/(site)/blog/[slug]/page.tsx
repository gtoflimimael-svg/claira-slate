import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { POSTS } from "@/lib/data";
import { Reveal } from "@/components/reveal";

type Block = { type: "p" | "h2" | "quote"; text: string };

const AUTHORS: Record<string, { name: string; initials: string }> = {
  "the-pdf-turns-33-time-it-learned-to-read-itself": { name: "Jonas Vik", initials: "JV" },
  "how-we-delete-your-files-and-prove-it": { name: "Sara Lindqvist", initials: "SL" },
  "merging-20-contracts-without-losing-the-order": { name: "Owen Marsh", initials: "OM" },
  "ocr-quality-what-actually-moves-the-needle": { name: "Dev Kapoor", initials: "DK" },
  "why-we-priced-pro-at-5": { name: "Elin Cho", initials: "EC" },
  "a-field-guide-to-compressing-scans": { name: "Owen Marsh", initials: "OM" },
};

const ARTICLES: Record<string, Block[]> = {
  "the-pdf-turns-33-time-it-learned-to-read-itself": [
    { type: "p", text: "The PDF was designed to be printed, not queried. Its whole job was to look identical on every machine, which it does beautifully — and that is exactly why it resists everything else you might want to do with it." },
    { type: "p", text: "Thirty-three years later, most of us do not print anything. We forward, sign, skim and search. The format never got a layer for any of that, so we built one: a reading layer that sits on top of the page geometry instead of replacing it." },
    { type: "h2", text: "Layout is meaning" },
    { type: "p", text: "A two-column contract with footnotes is not a stream of words. Position carries information — which clause governs, what a table header refers to, where a signature block ends. Extracting text and throwing away coordinates loses most of the document." },
    { type: "quote", text: "A summary you cannot verify is a rumour. Every answer should come back with the page it came from." },
    { type: "p", text: "So the reading layer keeps the box coordinates of every span it uses. When Claira tells you the termination fee is two months of committed spend, it can point at §9.4 on page 29 — and you can check it in one click. That constraint shaped the entire product." },
    { type: "h2", text: "What we deliberately left out" },
    { type: "p", text: "No document library you have to organise. No chat history to manage. No account before your first file. The AI is a tool in the toolbox, next to merge and compress, and your file is gone an hour later." },
    { type: "p", text: "That is the whole bet: the tools people already use every day, plus a document that finally answers back." },
  ],
  "how-we-delete-your-files-and-prove-it": [
    { type: "p", text: "A one-hour retention promise is easy to write on a pricing page and hard to build underneath it. Every file that touches Claira Slate carries an expiry timestamp from the moment it lands, and the deletion job doesn't ask permission — it just runs." },
    { type: "h2", text: "The queue, the keys, and the audit trail" },
    { type: "p", text: "Uploads go into a container that is torn down, not wiped, once a job finishes or the hour elapses, whichever comes first. The encryption key for that container is discarded at the same moment, so even a container that somehow survived would just be ciphertext with nothing to open it." },
    { type: "p", text: "Every deletion writes a line to an append-only audit log — file id, timestamp, reason — that we can show an auditor without showing them a single byte of the document itself." },
    { type: "h2", text: "Why an hour, not a promise to delete \"eventually\"" },
    { type: "p", text: "\"Eventually\" is where good intentions go to become a backlog. An hour is short enough to be a real constraint on the system, which is the only kind of privacy promise worth making." },
  ],
  "merging-20-contracts-without-losing-the-order": [
    { type: "p", text: "Ordering is the part everyone gets wrong. Drop twenty files into a merge tool and the browser's own upload order rarely matches the order you actually meant — alphabetical, chronological, whatever your counterparty expects." },
    { type: "h2", text: "Three habits that make a 400-page merge boring" },
    { type: "p", text: "First, name files so their sort order is your order — a leading two-digit prefix beats trusting any tool to guess. Second, always look at the arrange step before you run the merge; a five-second scan catches the one file that landed in the wrong place. Third, keep a cover page or table of contents as file one, so a misordered merge is obvious the moment you open it." },
    { type: "p", text: "None of this is clever. It just turns a merge from something you check afterward into something you got right the first time." },
  ],
  "ocr-quality-what-actually-moves-the-needle": [
    { type: "p", text: "Resolution matters less than you think. Past about 300 DPI, throwing more pixels at a scan barely moves recognition accuracy — the bottleneck has already moved somewhere else." },
    { type: "h2", text: "Deskewing matters more" },
    { type: "p", text: "A page scanned two degrees off-axis degrades character recognition far more than a page scanned at lower resolution but dead straight. Most of our OCR failures trace back to skew, shadow and page curl — not pixel count." },
    { type: "p", text: "So the pipeline spends its effort there: straightening, flattening, and normalising contrast before a single character gets recognised. It's less glamorous than a bigger model, and it's most of the improvement." },
  ],
  "why-we-priced-pro-at-5": [
    { type: "p", text: "Pricing is positioning. We wanted the number to be forgettable — small enough that nobody debates it, memorable enough that nobody has to look it up twice." },
    { type: "p", text: "Five dollars a month is roughly a coffee. It's also, not coincidentally, less than the mental overhead of deciding whether a single merge is worth paying for. Below that threshold, price stops being a decision and starts being a formality." },
    { type: "h2", text: "The alternative we didn't take" },
    { type: "p", text: "We could have priced by usage — per document, per AI action — and captured more from our heaviest users. We chose a flat number instead, because a bill that changes every month is a reason to think about switching tools, and we'd rather you never have that thought." },
  ],
  "a-field-guide-to-compressing-scans": [
    { type: "p", text: "Compression is a series of small decisions, and getting them in the wrong order costs you quality for nothing. Know which lever you're pulling before you pull it." },
    { type: "h2", text: "When to downsample" },
    { type: "p", text: "If a scan is going to be read on a screen, not printed, dropping it to 150–200 DPI before anything else usually costs nothing visible and shrinks the file dramatically. Downsampling a document destined for print is the one place to leave resolution alone." },
    { type: "h2", text: "When to re-encode, and when to leave it alone" },
    { type: "p", text: "A scan that's already been through lossy compression once will only get worse the second time — re-encoding a JPEG-derived PDF just stacks artefacts on artefacts. In that case the honest move is to leave the images alone and compress the container instead." },
  ],
};

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) return {};
  return { title: `${post.title} — Claira Slate`, description: post.excerpt };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) notFound();

  const author = AUTHORS[post.slug] ?? { name: "Claira Slate Team", initials: "CS" };
  const body = ARTICLES[post.slug] ?? [{ type: "p" as const, text: post.excerpt }];
  const morePosts = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <>
      <article style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(48px,6vw,88px) 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
          <Link href="/blog" className="hover-text" style={{ cursor: "pointer", color: "var(--cs-text-2)" }}>
            Blog
          </Link>
          <span style={{ color: "var(--cs-line)" }}>/</span>
          <span style={{ color: "var(--cs-text)" }}>{post.cat}</span>
        </div>

        <h1
          style={{
            margin: "26px 0 0",
            fontFamily: "var(--font-geist), Inter, sans-serif",
            fontWeight: 600,
            fontSize: "clamp(32px,4.8vw,52px)",
            lineHeight: 1.06,
            letterSpacing: "-.04em",
          }}
        >
          {post.title}
        </h1>

        <div
          style={{
            marginTop: 26,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            paddingBottom: 26,
            borderBottom: "1px solid var(--cs-line)",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "var(--cs-accent-soft)",
              border: "1px solid var(--cs-accent-line)",
              display: "grid",
              placeItems: "center",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--cs-accent)",
            }}
          >
            {author.initials}
          </div>
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{author.name}</span>
            <span style={{ color: "var(--cs-text-2)" }}> &middot; {post.cat}</span>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
            {post.date} &middot; {post.read}
          </div>
        </div>

        {body.map((block, i) => {
          if (block.type === "h2") {
            return (
              <h2 key={i} style={{ margin: "40px 0 0", fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.2 }}>
                {block.text}
              </h2>
            );
          }
          if (block.type === "quote") {
            return (
              <blockquote
                key={i}
                style={{
                  margin: "32px 0 0",
                  padding: "22px 26px",
                  borderLeft: "2px solid var(--cs-accent)",
                  background: "var(--cs-bg-2)",
                  borderRadius: "0 12px 12px 0",
                  fontFamily: "var(--font-geist), Inter, sans-serif",
                  fontSize: 19,
                  lineHeight: 1.5,
                  letterSpacing: "-.02em",
                }}
              >
                {block.text}
              </blockquote>
            );
          }
          const isLead = i === 0;
          return (
            <p
              key={i}
              style={{
                margin: isLead ? "32px 0 0" : "22px 0 0",
                fontSize: isLead ? 18 : 17,
                lineHeight: isLead ? 1.7 : 1.75,
                color: isLead ? "var(--cs-text)" : "var(--cs-text-2)",
              }}
            >
              {block.text}
            </p>
          );
        })}

        <div style={{ marginTop: 44, paddingTop: 28, borderTop: "1px solid var(--cs-line)", display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href="/ai/summarize" style={{ padding: "12px 20px", borderRadius: 10, background: "var(--cs-accent)", color: "#fff", fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}>
            Try summarizing a PDF
          </Link>
          <Link
            href="/blog"
            className="hover-border hover-text"
            style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid var(--cs-line)", color: "var(--cs-text)", fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}
          >
            Back to blog
          </Link>
        </div>
      </article>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px,7vw,96px) 24px clamp(56px,7vw,96px)" }}>
        <Reveal
          as="h2"
          style={{ margin: 0, fontFamily: "var(--font-geist), Inter, sans-serif", fontWeight: 600, fontSize: "clamp(24px,3vw,32px)", lineHeight: 1.1, letterSpacing: "-.03em" }}
        >
          Keep reading
        </Reveal>
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(300px,100%),1fr))", gap: 14 }}>
          {morePosts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="hover-border hover-text"
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 24,
                border: "1px solid var(--cs-line)",
                borderRadius: "var(--cs-r)",
                background: "var(--cs-card)",
                color: "var(--cs-text)",
                cursor: "pointer",
                minHeight: 180,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 11.5, fontWeight: 500, color: "var(--cs-text-2)" }}>
                <span style={{ padding: "3px 9px", borderRadius: 6, background: "var(--cs-bg-2)", fontWeight: 600 }}>{p.cat}</span>
                <span>{p.date}</span>
              </div>
              <div style={{ marginTop: 16, fontFamily: "var(--font-geist), Inter, sans-serif", fontSize: 18, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-.025em" }}>
                {p.title}
              </div>
              <div style={{ marginTop: "auto", paddingTop: 18, fontSize: 12.5, fontWeight: 500, color: "var(--cs-text-2)" }}>{p.read}</div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

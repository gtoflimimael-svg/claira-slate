export interface Tool {
  slug: string;
  name: string;
  desc: string;
  cat: string;
  d: string;
}

const RAW_TOOLS: [string, string, string, string, string][] = [
  ["merge", "Merge PDF", "Combine files into one.", "Organize", "M3 3h10v10H3zM11 11h10v10H11z"],
  ["split", "Split PDF", "Separate into parts.", "Organize", "M12 3v18M5 8l-3 4 3 4M19 8l3 4-3 4"],
  ["reorder", "Organize pages", "Drag pages into order.", "Organize", "M3 4h7v7H3zM14 4h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  ["rotate", "Rotate PDF", "Fix page orientation.", "Organize", "M20.5 12A8.5 8.5 0 1 1 17 5.2M20.5 4v5h-5"],
  ["extract-pages", "Extract pages", "Pull out what you need.", "Organize", "M12 3v10M8 9l4 4 4-4M4 19h16"],
  ["delete-pages", "Delete pages", "Remove what you don't.", "Organize", "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"],
  ["compress", "Compress PDF", "Smaller file, same quality.", "Optimize", "M12 3v6M9 6l3 3 3-3M12 21v-6M9 18l3-3 3 3M4 12h16"],
  ["repair", "Repair PDF", "Recover damaged files.", "Optimize", "M20 7l-3-3-9 9 3 3zM8 16l-4 5 5-4"],
  ["optimize", "Optimize for web", "Fast-loading documents.", "Optimize", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3c-4 4.5-4 13.5 0 18M12 3c4 4.5 4 13.5 0 18"],
  ["flatten", "Flatten PDF", "Bake in forms and layers.", "Optimize", "M4 8l8-4 8 4-8 4zM4 14l8 4 8-4"],
  ["grayscale", "Grayscale PDF", "Convert every page to grayscale.", "Optimize", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18"],
  ["crop", "Crop PDF", "Trim the margins.", "Optimize", "M6 2v16h16M2 6h16v16"],
  ["pdf-to-word", "PDF to Word", "Fully editable .docx.", "Convert", "M5 4h9l4 4v12H5zM8 12l1.5 5L11 13l1.5 4L14 12"],
  ["pdf-to-excel", "PDF to Excel", "Tables into spreadsheets.", "Convert", "M5 4h9l4 4v12H5zM9 11l6 6M15 11l-6 6"],
  ["pdf-to-ppt", "PDF to PowerPoint", "Slides you can edit.", "Convert", "M5 4h9l4 4v12H5zM9.5 17v-6h2a2 2 0 0 1 0 4h-2"],
  ["pdf-to-jpg", "PDF to JPG", "Every page an image.", "Convert", "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8 9.5h.01"],
  ["word-to-pdf", "Word to PDF", "Convert Word documents to PDF perfectly.", "Convert", "M5 4h9l4 4v12H5zM8 12l1.5 5L11 13l1.5 4L14 12"],
  ["excel-to-pdf", "Excel to PDF", "Convert spreadsheets to PDF documents.", "Convert", "M5 4h9l4 4v12H5zM9 11l6 6M15 11l-6 6"],
  ["ppt-to-pdf", "PowerPoint to PDF", "Convert presentations to PDF slides.", "Convert", "M5 4h9l4 4v12H5zM9.5 17v-6h2a2 2 0 0 1 0 4h-2"],
  ["jpg-to-pdf", "JPG to PDF", "Images into one file.", "Convert", "M4 4h8l4 4v8H4zM4 13l3-3 2 2 2-3 5 5M12 4v4h4"],
  ["html-to-pdf", "HTML to PDF", "Capture any web page.", "Convert", "M9 8l-4 4 4 4M15 8l4 4-4 4M4 4h16v16H4z"],
  ["protect", "Protect PDF", "Lock it with a password.", "Secure", "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3"],
  ["unlock", "Unlock PDF", "Remove known passwords.", "Secure", "M5 11h14v9H5zM8 11V8a4 4 0 0 1 7.6-1.6"],
  ["sign", "Sign PDF", "Legally binding e-signature.", "Secure", "M3 17c4 0 5.5-11 8.5-11S13 14 15 14s3-1.5 6-1.5M3 21h18"],
  ["redact", "Redact PDF", "Black out for good.", "Secure", "M4 6h16v4H4zM4 14h9M4 18h6"],
  ["certify", "Certify PDF", "Add a certifying signature.", "Secure", "M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM9 11l-2 9 5-3 5 3-2-9"],
  ["watermark", "Watermark", "Stamp text or a logo.", "Secure", "M12 3s6 6.3 6 10a6 6 0 0 1-12 0c0-3.7 6-10 6-10z"],
  ["edit-text", "Edit PDF", "Text, images and shapes.", "Edit", "M4 20h4L19 9l-4-4L4 16zM15 5l4 4"],
  ["number-pages", "Add page numbers", "Any position, any style.", "Edit", "M5 3h14v18H5zM10 17h4M12 13.5h.01"],
  ["header-footer", "Header & footer", "Add running header and footer text.", "Edit", "M5 3h14v18H5zM7 7h10M7 17h10"],
  ["ocr", "OCR PDF", "Make scans searchable.", "Edit", "M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 12h8"],
  ["annotate", "Annotate", "Comment and highlight.", "Edit", "M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"],
];

export const TOOLS: Tool[] = RAW_TOOLS.map(([slug, name, desc, cat, d]) => ({ slug, name, desc, cat, d }));

export const CATS: string[] = ["All", "Organize", "Optimize", "Convert", "Secure", "Edit"];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  ["Is Claira Slate free to use?", "Yes. All 26 tools are free, with no watermarks and no account required. Free merges are capped at 20 MB and 5 files; Pro lifts every limit for $5/month."],
  ["How many files can I merge at once?", "Up to 5 files on the free plan, and up to 20 per merge on Pro — in any order, with drag-to-reorder before you run it."],
  ["Are my files safe?", "Uploads are encrypted in transit, processed in an isolated container and permanently deleted one hour later. We never train models on your documents."],
  ["Can I merge PDFs on mobile?", "Yes. The tool runs in any mobile browser, and files can come from Files, Drive, Dropbox or your camera roll."],
].map(([q, a]) => ({ q, a }));

export const RELATED: string[] = ["Split PDF", "Compress PDF", "PDF to Word", "Organize pages"];

export interface Post {
  title: string;
  cat: string;
  date: string;
  read: string;
  excerpt: string;
  slug: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const RAW_POSTS: [string, string, string, string, string][] = [
  ["The PDF turns 33. Time it learned to read itself.", "Product", "Jul 22, 2026", "6 min read", "Every format eventually gets a brain. Here is how we thought about putting one inside a file nobody wanted to open."],
  ["How we delete your files — and prove it", "Engineering", "Jul 14, 2026", "4 min read", "A one-hour retention promise is easy to write and hard to build. A walk through the queue, the keys and the audit trail."],
  ["Merging 20 contracts without losing the order", "Guides", "Jul 2, 2026", "5 min read", "Ordering is the part everyone gets wrong. Three habits that make a 400-page merge boring."],
  ["OCR quality: what actually moves the needle", "Engineering", "Jun 24, 2026", "8 min read", "Resolution matters less than you think. Deskewing matters more."],
  ["Why we priced Pro at $5", "Company", "Jun 11, 2026", "3 min read", "Pricing is positioning. We wanted the number to be forgettable."],
  ["A field guide to compressing scans", "Guides", "May 29, 2026", "7 min read", "When to downsample, when to re-encode, and when to leave the file alone."],
];

export const POSTS: Post[] = RAW_POSTS.map(([title, cat, date, read, excerpt]) => ({
  title,
  cat,
  date,
  read,
  excerpt,
  slug: slugify(title),
}));

export interface HistoryItem {
  name: string;
  tool: string;
  pages: string;
  size: string;
  when: string;
  available: boolean;
}

const RAW_HISTORY: [string, string, string, string, string, number][] = [
  ["merged-document.pdf", "Merge", "42 pages", "5.7 MB", "Today, 09:41", 1],
  ["Q3-report-final.pdf", "Compress", "18 pages", "4.8 MB", "Today, 09:12", 1],
  ["contract-2026.pdf", "Summarize (AI)", "11 pages", "2.1 MB", "Yesterday, 17:30", 1],
  ["scan-batch-04.pdf", "OCR", "96 pages", "28.4 MB", "Yesterday, 11:02", 1],
  ["invoice-june.pdf", "PDF to Word", "3 pages", "0.6 MB", "Jul 24, 16:20", 0],
  ["deck-v2.pdf", "Split", "24 pages", "9.1 MB", "Jul 23, 08:55", 0],
];

export const HISTORY: HistoryItem[] = RAW_HISTORY.map(([name, tool, pages, size, when, available]) => ({
  name,
  tool,
  pages,
  size,
  when,
  available: !!available,
}));

export interface Invoice {
  date: string;
  plan: string;
  amount: string;
}

export const INVOICES: Invoice[] = [
  ["Jul 1, 2026", "Pro — monthly", "$5.00"],
  ["Jun 1, 2026", "Pro — monthly", "$5.00"],
  ["May 1, 2026", "Pro — monthly", "$5.00"],
  ["Apr 1, 2026", "Pro — monthly", "$5.00"],
].map(([date, plan, amount]) => ({ date, plan, amount }));

export interface TeamMember {
  name: string;
  email: string;
  role: string;
  active: boolean;
}

const RAW_TEAM: [string, string, string, number][] = [
  ["Maya Rendel", "maya@northwind.co", "Owner", 1],
  ["Tomas Beck", "tomas@northwind.co", "Admin", 1],
  ["Priya Anand", "priya@northwind.co", "Member", 1],
  ["Luis Ortega", "luis@northwind.co", "Member", 0],
  ["Ana Kovac", "ana@northwind.co", "Member", 1],
];

export const TEAM: TeamMember[] = RAW_TEAM.map(([name, email, role, active]) => ({
  name,
  email,
  role,
  active: !!active,
}));

export interface UsageDay {
  day: string;
  value: number;
}

export const USAGE: UsageDay[] = [
  ["Mon", 42],
  ["Tue", 68],
  ["Wed", 31],
  ["Thu", 84],
  ["Fri", 57],
  ["Sat", 12],
  ["Sun", 22],
].map(([day, value]) => ({ day: day as string, value: value as number }));

export interface Lang {
  code: string;
  name: string;
  tools: string;
  ai: string;
  pricing: string;
  blog: string;
  tagline: string;
  rtl: boolean;
}

const RAW_LANGS: [string, string, string, string, string, string, string, number?][] = [
  ["en", "English", "Tools", "AI", "Pricing", "Blog", "A clean slate for your documents."],
  ["fr", "Français", "Outils", "IA", "Tarifs", "Blog", "Une ardoise vierge pour vos documents."],
  ["es", "Español", "Herramientas", "IA", "Precios", "Blog", "Una hoja en blanco para tus documentos."],
  ["de", "Deutsch", "Tools", "KI", "Preise", "Blog", "Ein leeres Blatt für Ihre Dokumente."],
  ["pt", "Português", "Ferramentas", "IA", "Preços", "Blog", "Uma folha limpa para os seus documentos."],
  ["it", "Italiano", "Strumenti", "IA", "Prezzi", "Blog", "Un foglio pulito per i tuoi documenti."],
  ["ja", "日本語", "ツール", "AI", "料金", "ブログ", "書類のための、まっさらな一枚。"],
  ["zh", "中文", "工具", "AI", "定价", "博客", "为你的文档，留一页空白。"],
  ["ar", "العربية", "الأدوات", "الذكاء", "الأسعار", "المدونة", "صفحة نظيفة لمستنداتك.", 1],
  ["hi", "हिन्दी", "टूल्स", "AI", "मूल्य", "ब्लॉग", "आपके दस्तावेज़ों के लिए एक साफ़ पन्ना।"],
  ["ko", "한국어", "도구", "AI", "가격", "블로그", "당신의 문서를 위한 깨끗한 한 장."],
  ["ru", "Русский", "Инструменты", "ИИ", "Цены", "Блог", "Чистый лист для ваших документов."],
];

export const LANGS: Lang[] = RAW_LANGS.map(([code, name, tools, ai, pricing, blog, tagline, rtl]) => ({
  code,
  name,
  tools,
  ai,
  pricing,
  blog,
  tagline,
  rtl: !!rtl,
}));

export interface SidebarItem {
  label: string;
  route: string;
  d: string;
}

export const SIDEBAR: SidebarItem[] = [
  ["Home", "app-home", "M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"],
  ["History", "app-history", "M12 21a9 9 0 1 0-9-9M3 3v6h6M12 8v4.5l3 2"],
  ["Files", "app-files", "M4 6a2 2 0 0 1 2-2h3l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"],
  ["AI Usage", "app-usage", "M4 19V9M10 19V4M16 19v-7M22 19H2"],
  ["Billing", "app-billing", "M3 7h18v11H3zM3 11h18M7 15h3"],
  ["Settings", "app-settings", "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4z"],
  ["Team", "app-team", "M16 20v-2a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v2M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a3 3 0 0 0-2.3-2.9M15.5 4.2a3.5 3.5 0 0 1 0 6.6"],
].map(([label, route, d]) => ({ label, route, d }));

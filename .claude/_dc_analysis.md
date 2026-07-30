# Claira Slate Homepage — dc.html structural analysis

Source files analyzed (authoritative, un-truncated copies):
- `/home/ma-l-toflimi-gbinlo/Téléchargements/Claira Slate homepage design.zip` → `Claira Slate Homepage.dc.html` (2308 lines, 275,102 bytes) and `support.js` (1912 lines, 69,150 bytes)

**Note on file integrity**: two other on-disk copies of this file (in the project's `design-reference/` dir and in the scratchpad) were byte-truncated at exactly 262,144 bytes (256 KiB — the `DesignSync.get_file` read cap), which cuts off mid-statement inside the `<script>` block around `window.addEventListener("scroll", ...`. **Do not use those copies as a reference for the JS logic** — use the zip in Téléchargements (or re-fetch via `DesignSync.get_file` in chunks / accept the cap doesn't bite here since actual content is under 256 KiB in *characters* but over it in *UTF‑8 bytes* because of the non‑Latin strings in the `LANGS` array). If re-extracting, verify tail integrity with `tail -c 200 file | grep -q '</html>'`.

---

## 1. Template syntax cheat-sheet (from `support.js`)

The `.dc.html` format is a proprietary micro-templating language compiled at runtime into React `createElement` calls. Mapping to real code:

| Construct | Meaning / real-code equivalent |
|---|---|
| `<x-dc>...</x-dc>` | Root wrapper; its `innerHTML` is the whole template. Discard wrapper when reimplementing — its children become your page/component tree. |
| `<helmet data-dc-atomics>...</helmet>` | Maps to `<head>` content (title/meta/link/style). `data-dc-atomics` just means "also inject the runtime's small atomic-CSS utility sheet" (classes like `.fx`, `.col`, `.ac`, `.jc`, `.gap8`…, defined in `ATOMIC_CSS` in support.js) — in a real app just author real CSS/Tailwind, these utility classes aren't otherwise used in this file. |
| `{{ expr }}` in text or in an attribute value | Expression interpolation. Supports: identifiers, dotted/bracket property paths (`a.b`, `a[i]`), string/number/bool/null literals, `!x` negation, `(…)` grouping, and top-level `===`/`!==`/`==`/`!=` comparisons. No arithmetic/ternary/function calls — those live in the JS `<script>` and are exposed to the template as pre-computed values on the render-vals object. |
| `<sc-if value="{{ expr }}">...</sc-if>` | Conditional render — `{expr && <>...</>}` in JSX. The `hint-placeholder-val` attribute is only a streaming/skeleton hint for the design tool, ignore it. |
| `<sc-for list="{{ expr }}" as="item">...</sc-for>` | List render — `{expr.map((item, i) => (...))}` in JSX. `hint-placeholder-count` is a streaming skeleton hint, ignore. |
| `onClick="{{ handlerName }}"` (also `onChange`, `onInput`, etc., or lowercase `onclick` etc.) | Standard React event prop, resolved from the render-vals object (a function). |
| `ref="{{ refName }}"` | React ref, resolved from render-vals (created via `React.createRef()` in the Logic class). |
| `style="prop:val;..."` with `{{ }}` inside | Inline style string → parsed to a JS style object (kebab→camel case, except CSS custom props `--x` stay as-is). |
| `style-hover="css"` | Compiles to a real injected `:hover` pseudo-class stylesheet rule scoped to a generated class name, appended to the element's `className`. In real code: just write a `:hover` rule in CSS/styled-components. |
| `data-screen-label="NN Name"` | **Pure design-tool annotation** — labels a block in the Claude Design canvas UI. Not functional; strip entirely. This is how the section list in §2 was extracted. |
| `data-dc-tpl`, `data-sc-name`, `sc-host`, `sc-placeholder`, etc. | Runtime bookkeeping/streaming-placeholder machinery. Irrelevant to a static reimplementation. |
| `<sc-helmet>` (aliased from `<helmet>`) | Handled by `createHelmetManager` — merges `<link>`/`<meta>`/`<style>`/`<script>` children into the real document `<head>` once. |
| `<dc-import>` / `<x-import>` | Mechanism for importing other design-system components / external JS modules. **Not used anywhere in this file** (verified — no matches). Ignore. |
| Custom/camelCase attributes like `crossOrigin` | Runtime auto-detects camelCase attrs (`sc-camel-` encoding trick) since HTML parsing lowercases attribute names; only relevant to the runtime's DOM parsing workaround, not to a reimplementation. |

**Bottom line for reimplementation**: treat the template body as JSX with `{{ x }}` → `{x}`, `<sc-if value="{{ x }}">` → `{x && (...)}`, `<sc-for list="{{ x }}" as="item">` → `{x.map((item, i) => (...))}`, and all `data-screen-label`/`data-dc-tpl`/hint-* attributes stripped.

---

## 2. Screens/routes present

This is a **single-page interactive prototype**: one `Component extends DCLogic` class with `state.route` (default `"home"`, overridable via the `startRoute` design prop) drives which of ~19 mutually-exclusive `<sc-if>` blocks renders. There is no real URL routing in the prototype — navigation is `setState({route: 'x'})` + `window.scrollTo(0,0)` (see `go(route)` in §3). A reimplementation should use real routes (e.g. Next.js pages/app-router) with one page per `route` value, but the section below is organized by the prototype's internal screen numbering (`data-screen-label`) since that's how the file is physically laid out.

| # | Label | Lines (zip copy) | Gate condition | Size | Completeness |
|---|---|---|---|---|---|
| 01 | Navbar | 171–227 | `showChrome` (`!isApp`) | 56 | Full — logo, 4 nav links w/ active underline, theme toggle, language switcher dropdown, Log in / Get started buttons |
| 02 | Hero | 227–309 | `isHome` | 82 | Full — animated headline, CTA buttons, trust bullets, decorative mock UI (browser chrome mock showing a "Compress" progress bar + a mini AI chat bubble), giant inline decorative SVG illustration (freepik-style, ~32 KB of path data, animated via `csBgFade`) |
| 03 | Tools grid | 309–338 | `isHome` | 29 | Full — category pills + 3×N tool cards (uses shared `shownTools`/`cats` computed lists, same ones used on the Tools index screen) |
| 04 | AI features | 338–371 | `isHome` | 33 | Full — 4-up feature cards (Summarize/Ask anything/Translate/OCR) + CTA |
| 05 | How it works | 371–409 | `isHome` | 38 | Full — 3-step numbered explainer |
| 06 | Pricing teaser | 409–452 | `isHome` | 43 | Full — 3 plan cards (Free/Pro/Business), condensed vs. the full Pricing screen |
| 07 | Social proof | 452–494 | `isHome` | 42 | Full — animated counter stat + 3 testimonial cards + 3 trust badges |
| 08 | Final CTA | 494–505 | `isHome` | 11 | Full — single banner with heading + button |
| 09 | Footer | 1308–1388 | `showChrome` | 80 | Full — 4 link columns (Tools/Company/Legal/Connect), language switcher, copyright |
| 10 | Tool page — Merge PDF | 505–722 | `isMerge` | 217 | Full — most complex screen: breadcrumb, 3-step state machine (Upload → Arrange → Done) with drag-reorder file list mock, FAQ accordion (4 items), related-tools rail, embedded "how to" video-card mock |
| 11 | Tools index | 722–761 | `isToolsIdx` | 39 | Full — full `/tools` directory (same tool-grid component reused, unfiltered "Ask AI" CTA) |
| 12 | AI hub | 761–845 | `isAiHub` | 84 | Full — 4 AI-tool cards, big "cites the page number" demo panel, trust bullets, CTA |
| 13 | AI feature — Summarize | 845–944 | `isSummarize` | 99 | Full — file-drop mock → summary result mock (4 bullet points w/ page refs), 3-step explainer, "other AI tools" rail |
| 14 | Pricing | 944–1023 | `isPricing` | 79 | Full — 3 plan cards (fuller copy than the teaser) + feature-comparison table |
| 15 | Blog listing | 1023–1063 | `isBlog` | 40 | Full — featured post + category filter pills + grid of post cards (`sc-for list="posts"`) |
| 16 | Blog post | 1063–1109 | `isPost` | 46 | Full — article header/byline + 2 prose sections + "keep reading" 3-card rail. **Article body content for only ONE post is authored** (`POSTS[0]`); the rest of `POSTS` is teaser data only (title/cat/date/read/excerpt), no full body — a real blog would need real per-post bodies. |
| 17 | About | 1109–1183 | `isAbout` | 74 | Full — 4 stat tiles, "what we hold to" 4-value list, trust/privacy links, hiring banner |
| 18 | Contact | 1183–1234 | `isContact` | 51 | Full — 3 contact-channel cards + a (non-functional, mock) contact form |
| 19 | Login | 1234–1268 | `isLogin` | 34 | Full — OAuth buttons (mock), email/password form (mock), remember-me, link to signup |
| 20 | Signup | 1268–1308 | `isSignup` | 40 | Full — value-prop bullets + testimonial + signup form (mock), link to login |
| 21 | App shell | 1388–2006(+) | `isApp` | ~620 | Full — see breakdown below; this is a whole mini product (dashboard) nested inside the same file |

### App shell (`isApp`) sub-screens
Gated by `showChrome=false` (no marketing navbar/footer) — instead a persistent sidebar (`SIDEBAR` data: Home/History/Files/AI Usage/Billing/Settings/Team) + top user bar (avatar, plan badge, logout). Sub-route booleans: `appHome`, `appHistory`, `appFiles`, `appUsage`, `appBilling`, `appSettings`, `appTeam`.

- **app-home**: greeting header, 4 KPI tiles (Documents/AI actions/Storage/Time saved, some using the `data-count` count-up animation), 4 quick-tool shortcuts, recent-activity list, "working with a team?" upsell banner.
- **app-history**: filterable/searchable table of past jobs (`histFilter` pills: All/Merged/Compressed/Converted/AI processed; `histQuery` free-text search over name+tool), empty state, mock statuses (Available/Expired).
- **app-files**: present per screen digest but not deeply inspected — likely a simple file-listing mock (same visual language as history).
- **app-usage**: `USAGE` 7-day bar chart (Mon–Sun, values 12–84 as a %-height bar).
- **app-billing**: current plan card + `INVOICES` table (4 rows: date/plan/amount).
- **app-settings**: theme On/Off toggle mirroring the global theme, other account settings.
- **app-team**: `TEAM` table (5 members: name/email/role/active-or-invited status) + "invite" modal (`inviteOpen`/`openInvite`/`closeInvite`).

**Scope note for implementation**: the design-project/file is literally titled "**Claira Slate Homepage**", but the `.dc.html` content is a full multi-screen product prototype (marketing site + app dashboard), not just the marketing landing page. Screens 01–09 (Navbar/Hero/Tools grid/AI features/How it works/Pricing teaser/Social proof/Final CTA/Footer) constitute the actual "homepage" in the narrow sense. Confirm with whoever is driving the implementation whether to build all ~19 screens or just the true homepage + global chrome first.

---

## 3. Global chrome & routing logic

**State shape** (`Component extends DCLogic`, `src≈1985`):
```js
state = {
  dark: false, cat: "All", docs: 0, faqOpen: 0, route: "home",
  toolState: 1, downloaded: false, histFilter: "All jobs", histQuery: "",
  inviteOpen: false, lang: "en", langOpen: "nav"
};
navRef = React.createRef();
```

**Routing** — `go(route)` returns an event handler:
```js
go(route) {
  return () => {
    this.setState({ route, toolState: route === "merge" ? 1 : this.state.toolState, downloaded: false });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
}
```
All nav handlers (`goHome`, `goTools`, `goMerge`, `goAi`, `goSummarize`, `goPricing`, `goBlog`, `goPost`, `goAbout`, `goContact`, `goLogin`, `goSignup`, `goApp`→`app-home`, `goHistory`, `goFiles`, `goUsage`, `goBilling`, `goSettings`, `goTeam`) are just `this.go("<route>")`. **In a real app these become `<Link href="/...">` / `router.push()` to real pages**, not client state.

**Route → boolean flags** (`routeVals()`, ~line 2187): computes `isHome`, `isToolsIdx`, `isMerge`, `isAiHub`, `isSummarize`, `isPricing`, `isBlog`, `isPost`, `isAbout`, `isContact`, `isLogin`, `isSignup`, `isApp` (+ 7 `appX` sub-flags), `showChrome = !isApp`, plus active-nav-link color logic (`navToolsActive/Color`, `navAiActive/Color`, etc. — grouping `tools`+`merge` as "Tools" active, `ai`+`summarize` as "AI" active, `blog`+`post` as "Blog" active).

**Navbar background-on-scroll effect** (`componentDidMount`/`onScroll`): navbar is `position:sticky` transparent by default; an imperative scroll listener toggles `nav.style.background/backdropFilter/borderBottomColor` once scrollY passes ~55% of the hero height (min 120px) or 6px on non-hero pages — a blur/frosted-glass effect on scroll. In React this is better done as a scroll-position `useState` + conditional class, but note it's deliberately imperative (direct `ref.style.x =`) to avoid re-render cost — a `useEffect` + throttled scroll listener setting a CSS class achieves the same visual result.

**Theme**: `setTheme(dark)` sets `document.documentElement.dataset.theme = dark ? "dark":"light"` and `state.dark`. Default comes from a `defaultTheme` design prop (`"light"` default). All colors are CSS custom properties (`--cs-*`) redefined under `html[data-theme="dark"]` (see §4) — **reimplement as a real light/dark theme via a `data-theme` attribute or Tailwind `dark:` class**, this maps directly.

**Language switcher**: `LANGS` array of 12 locales (en/fr/es/de/pt/it/ja/zh/ar/hi/ko/ru) with per-locale nav-label strings (`tools`,`ai`,`pricing`,`blog`) and a `tagline`; `ar` is flagged `rtl:true`. Only nav label text + hero tagline actually change per language in this prototype — **it is not a real i18n system**, just a cosmetic dropdown (`langVals()` swaps 5 strings). Three independent open/close toggles for the same dropdown UI in 3 places: navbar (`navLangOpen`), footer (`footLangOpen`), app sidebar (`sideLangOpen`), all backed by one `state.langOpen` enum (`"nav"|"foot"|"side"|null`) with click-outside-to-close via a document click listener.

**Scroll-reveal animations**: a hand-rolled `IntersectionObserver`-based system — any element with `data-reveal` (optionally `data-reveal="left|right|scale|fade"`) fades/slides in in the viewport; elements with `data-count="12345.6"` count up from 0 via `requestAnimationFrame` easing (`countUp`); a `MutationObserver` re-scans for new `[data-reveal]`/`[data-count]` nodes after route changes (since screens mount/unmount within the same DOM tree). Respects `prefers-reduced-motion`. **In a real reimplementation, replace with a small IntersectionObserver hook or a library (e.g. framer-motion `whileInView`, or CSS `@starting-style`/scroll-driven animations) — don't need the exact same imperative code.**

**Animated document counter** (hero "documents processed" stat): starts at 0, eases up to `48,219,364` over 1.5s, then increments by a random 1–4 every 900ms indefinitely (`startCounter`) — a "live ticking" illusion.

---

## 4. Design tokens

**Fonts**: Google Fonts `Geist:wght@400..700` and `Inter:wght@400;500;600` (Inter is the body font: `font-family:Inter,system-ui,sans-serif`; Geist doesn't appear to be referenced by name in any style rule found — likely intended for numeric/display text but verify via `font-family:Geist` grep if pixel-perfect fidelity matters).

**Color tokens** (`:root`, light is default):
```css
--cs-accent:      #6C63FF
--cs-accent-ink:  color-mix(in oklab, var(--cs-accent) 86%, #000)
--cs-accent-soft: color-mix(in oklab, var(--cs-accent) 7%, var(--cs-bg))
--cs-accent-line: color-mix(in oklab, var(--cs-accent) 26%, var(--cs-bg))
--cs-bg:    #FFFFFF      --cs-bg-2:  #FAFAFB
--cs-ink:   #1A1A2E      --cs-ink-2: #232342
--cs-ink-line: rgba(255,255,255,.10)
--cs-text:  #111111      --cs-text-2: #8B8FA8
--cs-line:  #EAEAF0
--cs-card:  #FFFFFF
--cs-ok:    #22C55E      --cs-bad: #EF4444
--cs-r:     12px                          /* card corner radius */
--cs-tool-bg: var(--cs-card)              /* swapped by "toolCardStyle" prop */
--cs-tool-line: var(--cs-line)
--cs-logo-s: #1A1A2E                      /* logo secondary stroke color */
--cs-cyan:  #06B6D4
--cs-grad:      linear-gradient(90deg, var(--cs-accent), var(--cs-cyan))
--cs-grad-135:  linear-gradient(135deg, var(--cs-accent), var(--cs-cyan))
--cs-ease:  cubic-bezier(.16,1,.3,1)
```
Dark theme overrides (`html[data-theme="dark"]`):
```css
--cs-bg:#131325  --cs-bg-2:#0F0F1E  --cs-ink:#0C0C18  --cs-ink-2:#17172B
--cs-text:#F4F4F8  --cs-text-2:#9296AE  --cs-line:#26264169  --cs-card:#1A1A2E
--cs-logo-s:#FFFFFF  --cs-cyan:#22D3EE
```
Dark mode also adds a very subtle (`opacity:.03`) fractal-noise SVG data-URI texture over `body::before`.

**Design props exposed to the design-tool editor** (`data-props` JSON on the `<script>` tag — these are the "knobs" a designer can tweak in Claude Design's canvas, not required for a code implementation but useful defaults):
- `accent` (color, default `#6C63FF`, swatch options `#6C63FF #111111 #22C55E #EF4444`)
- `defaultTheme` (enum `light|dark`, default `light`)
- `cardRadius` (range 6–20px, default 12)
- `toolCardStyle` (enum `outline|tinted`, default `outline`)
- `startRoute` (enum, one entry per `route` value, default `home`)

**Radius/spacing**: single global radius var `--cs-r:12px` used for cards; nav pill radius `8px`; button/pill radii mostly `8–12px` or `99px` (full pill) per-element, no separate spacing-scale tokens — spacing is ad hoc pixel values in inline styles (`gap:24px`, `padding:0 24px`, etc.), not a formal scale.

**Motion**: ~25 named `@keyframes` (`csFill`, `csDot`, `csCaret`, `csFade`, `csDrop`, `csShimmer`, `csPulseBorder`, `csGlow`, `csBar`, `csRise`, `csLogoTilt`, `csDraw`, `csFloat`, `csOrbitA/B/C`, `csScan`, `csNode`, `csSpeck`, `csSpin` (uses `@property --csAngle` for a conic-gradient spinning border), `csProGlow`, `csFlipIn`, `csInLeft/Right`, `csDrift`, `csType`, `csTextSweep`, `csTickLoop`, `csLineIn`, `csSway`, `csBreathe`, `csScreenScan`, `csBadgePop`, `csLampGlow`, `csMug`, `csBgFade`, `csSkeleton`) driving: word-by-word hero headline reveal (`[data-word]`), logo wobble, card shine sweep on hover (`[data-card]`), icon spin on hover, gradient-border spinner (`[data-spinborder]`), starfield drift, staggered flip/slide-in grids (`[data-flipgrid]`, `[data-sidenav]`, `[data-rows]`), skeleton shimmer, and small decorative UI-mock animations (typing caret, progress fill, dots, scanning line) inside the hero's mock browser window and merge-tool mock. All respect `prefers-reduced-motion: reduce` (durations forced to ~0).

**Responsive breakpoints**: `880px` (nav wraps, app sidebar becomes horizontal/top), `820px` (hero decorative illustration hidden), `620px` (nav "ghost" element hidden, steps grid collapses to 1 column).

---

## 5. Data model (JS constants in the `<script>` block)

| Constant | Shape | Sample row | Used by |
|---|---|---|---|
| `TOOLS` | `[name, desc, cat, svgPathD]` → mapped to `{name, desc, cat, d}` | `["Merge PDF","Combine files into one.","Organize","M3 3h10v10H3z..."]` | Tools grid (home + index), merge-tool "related" rail. **26 entries** across categories Organize/Optimize/Convert/Secure/Edit (each icon is a raw SVG path `d` attribute, no external icon library). |
| `CATS` | `string[]` | `["All","Organize","Optimize","Convert","Secure","Edit"]` | Category filter pills, drives `shownTools` |
| `FAQS` | `[question, answer]` (4 entries) | `["Is Claira Slate free to use?", "Yes. All 26 tools..."]` | Merge-tool page accordion (`faqOpen` index in state) |
| `RELATED` | `string[]` of tool names (4) | `["Split PDF","Compress PDF","PDF to Word","Organize pages"]` | Merge-tool "related tools" rail — resolved against `TOOLS` by name |
| `POSTS` | `[title, category, date, readTime, excerpt]` (looked like ≥6 entries, only first one's full body is separately hand-authored in the Blog-post screen's static JSX) | `["The PDF turns 33...","Product","Jul 22, 2026","6 min read","Every format eventually..."]` | Blog listing (`featured`=`POSTS[0]`, `posts`=rest), blog post "keep reading" (`morePosts`=`POSTS.slice(1,4)`) |
| `HISTORY` | `[filename, tool, pages, size, when, availableFlag(0/1)]` (6 entries) | `["merged-document.pdf","Merge","42 pages","5.7 MB","Today, 09:41",1]` | App → History table + App → Home "recent activity" |
| `INVOICES` | `[date, planLabel, amount]` (4 entries) | `["Jul 1, 2026","Pro — monthly","$5.00"]` | App → Billing |
| `TEAM` | `[name, email, role, activeFlag(0/1)]` (5 entries) | `["Maya Rendel","maya@northwind.co","Owner",1]` | App → Team |
| `USAGE` | `[dayLabel, percentValue]` (7 entries, Mon–Sun) | `["Mon",42]` | App → AI Usage bar chart |
| `LANGS` | `[code,name,toolsLabel,aiLabel,pricingLabel,blogLabel,tagline,rtl?]` (12 entries) mapped to objects | `["en","English","Tools","AI","Pricing","Blog","A clean slate for your documents."]` | Language switcher (nav/footer/app-sidebar) |
| `SIDEBAR` | `[label, routeName, svgPathD]` (7 entries) | `["Home","app-home","M4 11 12 4l8 7v8a1..."]` | App shell left nav |

Computed/derived collections built in `renderVals()`/`routeVals()`/`langVals()` (not raw constants, but worth knowing since a reimplementation will need equivalent selectors): `cats` (adds active-state styling + click handler per category), `shownTools` (filtered `TOOLS` by active category), `faqs` (adds open/toggle per FAQ), `related`/`allTools`, `sidebar` (adds active-state styling per nav item), `featured`/`posts`/`morePosts`, `history`/`histRows` (filtered+searched), `histFilters` (pill list with active styling), `invoices`, `team` (adds initials + status styling), `usage` (adds bar height %).

---

## 6. Assets referenced

Only **one** of the three uploaded assets is actually wired into the template:
- `uploads/claira-slate-lettermark.svg` → used solely as the page favicon (`<link rel="icon" type="image/svg+xml" href="uploads/claira-slate-lettermark.svg">`). The actual navbar/footer logo is a hand-drawn inline `<svg viewBox="0 0 120 120">` with two `<path>` strokes colored `var(--cs-accent)` and `var(--cs-logo-s)` (not the uploaded file) — reimplement the logo as inline SVG, not an `<img>`.
- `uploads/Freelancer-cuate.svg` and `uploads/_.jpeg` — **uploaded but not referenced anywhere in the template or script.** Dead assets; skip them unless the intent was to use one as the hero illustration instead of the giant inline freepik SVG (see below) — worth a quick check with whoever owns the design of whether `Freelancer-cuate.svg` was meant to replace the inline illustration.
- The hero (screen 02) contains one enormous (~32 KB of raw path data, single-line) inline `<svg>` "freepik"-style illustration (`id="freepik--background-complete--inject-223"` and sibling groups), animated via `csBgFade` opacity pulse, hidden below 820px viewport width. **Recommend copying this SVG verbatim from the source file into a `.svg` asset/component** rather than hand-transcribing it — it's decorative and not worth re-drawing.
- No other `<img>` tags or bitmap assets are used; testimonial "avatars" (MR/TB/PA, Maya Rendel's "MR" in the app shell) are text-initials in colored circles, not images.

---

## 7. Interactive behaviors (beyond static rendering)

All of these are **client-side mocks with no real backend** — state transitions only, no network calls:

1. **Theme toggle** — instant light/dark swap via `data-theme` attribute + CSS var cascade (see §3/§4).
2. **Language switcher** (×3 instances) — cosmetic only, swaps 5 nav strings + hero tagline; click-outside-to-close.
3. **Category filter pills** (Tools grid / Tools index) — filters the 26-item `TOOLS` array client-side, single-select.
4. **FAQ accordion** (Merge-tool page) — single-open accordion (`faqOpen` index, `-1`/absent = none open), plus/minus sign swap.
5. **Merge PDF tool state machine** — 3 fake steps: `toolState` 1 (Upload, drop-zone + 3 pre-seeded mock files) → `pickFiles()` → 2 (Arrange, drag-to-reorder mock file list, "×" remove buttons wired to `f.toggle`) → `runMerge()` → 3 (Done, shows a merged-file result card) → `download()` sets a `downloaded` flag that flips the button label to "Downloaded" → `mergeAgain()` resets to step 1. No real file upload/processing occurs — it's entirely simulated with hard-coded filenames/sizes.
6. **Summarize AI tool mock** — file-drop UI that (per the screen's static content) shows a pre-baked 4-bullet summary result with page citations; likely similarly a fixed "demo" state rather than a real upload flow (not fully confirmed line-by-line, but consistent with the Merge tool's pattern and the "Ready in 4s" static label).
7. **Contact / Login / Signup forms** — rendered form fields, but no submit-handler logic was found beyond navigation buttons (`goApp` etc.) — these are visual-only forms; treat as needing new real form-handling code in the reimplementation (validation, submission) since the prototype has none.
8. **App → History** — live client-side filter (pill buttons, grouped categories: Merged/Compressed/Converted/AI processed) + free-text search box (`histQuery`, matches filename or tool substring, case-insensitive) combined with `filteredHistory()`; empty-state block (`histEmpty`) vs. populated table (`histHasRows`); `clearHist()` resets both filter and query.
9. **App → Team invite modal** — `inviteOpen` boolean toggled by `openInvite`/`closeInvite`; modal contents not deeply inspected but likely a simple email-invite form mock.
10. **Scroll-reveal-on-view animations** — IntersectionObserver-driven fade/slide-in for elements marked `data-reveal` (variants: default/`left`/`right`/`scale`/`fade`), re-scanned via `MutationObserver` on every route change since screens share one DOM subtree.
11. **Animated counters** — the hero's "documents processed" stat (`docs`) eases up to 48,219,364 over 1.5s then free-runs +1..4 every 900ms forever; any element with `data-count="N"` (e.g. App-home KPI tiles) eases up to `N` once when scrolled into view.
12. **Sticky navbar background-on-scroll** — transparent-over-hero → frosted/blurred once scrolled past ≈55% of hero height (imperative style mutation via `navRef`, not React state, for perf).
13. **Decorative-only animations** (no state, pure CSS `@keyframes`): typing caret, progress-bar fill, "3 dots" loading, hero SVG breathing, logo tilt wobble, hover shine-sweep on cards (`[data-card]:hover`), spinning conic-gradient border (`[data-spinborder]`), starfield drift.

---

## Recommendation for scope / next step

Given the file's actual title is "Claira Slate Homepage" but its content is really a ~19-screen product prototype (marketing site + logged-in app shell), the fastest path to something shippable is:

1. Build the **global chrome** first (navbar + footer + theme + language-switcher UI, no real i18n) since every screen depends on it.
2. Implement the **true homepage** (screens 01–09: Navbar/Hero/Tools grid/AI features/How it works/Pricing teaser/Social proof/Final CTA/Footer) as the priority deliverable — this matches the file's name and is what "Homepage" most literally means.
3. Treat the other ~13 screens (Merge tool, Tools index, AI hub, Summarize, Pricing, Blog ×2, About, Contact, Login, Signup, App shell ×7) as a secondary, larger body of work — each is a real, fully-designed screen, not a stub, so they're legitimate implementation targets, just likely out of scope for a first pass literally called "Homepage."
4. Reuse the CSS custom-property token system (§4) as-is (it maps cleanly to a `:root`/`[data-theme="dark"]` CSS setup, or Tailwind CSS variables) rather than re-deriving colors.
5. Copy the inline hero SVG illustration and the 26 tool icon path strings verbatim (they're already isolated, reusable `d` attributes) rather than re-authoring icons.

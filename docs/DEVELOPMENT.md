# Development

Hugo blog (bnmoch3.org) with the in-repo theme `themes/bnm`, derived from tomfran/typo (MIT).
Plan and status: `docs/PLAN.md`. Typography rationale: `docs/typography.md` (long; read only when
the reason behind a rule is unclear).

## Commands

```sh
make dev            # hugo server --renderToMemory -D (drafts, live reload, writes nothing)
make build-dev      # hugo -D into build/dev, for inspecting final HTML
scripts/urldiff.sh  # rebuild to a temp dir and diff URLs against docs/url-baseline.txt
make publish CONFIRM=1  # owner only: builds into build/main and pushes the deploy repo
```

Safety: never run `make publish`, never commit or push in `build/main`, and never run `hugo`
without `-d <scratch dir>` or `--renderToMemory` (plain `hugo` / `hugo server` write into
`build/main`). `make publish` refuses to run without `CONFIRM=1`.

Hugo version: **0.148.x**. The **standard (non-extended)** edition must build the site. The theme's
`hugo.toml` enforces `min = "0.148.0"`.

## Rules

- **No Sass, no Tailwind, no Node build step.** Plain modern CSS (custom properties, nesting, Grid) and
  plain JS files. Hugo Pipes only: `resources.Concat`, `minify`, `fingerprint`.
- **Never touch** `build/main` (deploy repo), `misc/`, or content bodies. Front matter changes are
  allowed only when a task needs them (e.g. `aliases`).
- **Light only.** No dark mode, no palette switching.
- **URL stability.** Every existing URL (`/p/<slug>/`, `/notes/YYYY/<slug>/`, `/blog/<slug>/` aliases,
  `/tags/...`, `/page/N/`, `index.xml`, `sitemap.xml`, canonical and `og:url`) stays identical.
  `docs/url-baseline.txt` is a snapshot of the original (typo-theme) build. After every change run
  `scripts/urldiff.sh [hugo-binary]`: it builds with `hugo --minify` into a temp dir (never
  `build/main`) and diffs (1) the sorted file list, (2) sitemap `<loc>` and RSS `<link>`, (3) every
  `canonical` and `og:url` against the baseline. Asset hashes are normalised. Expected differences:
  the 63 added `/blog/<slug>/` alias pages (plus their canonical lines) and renamed font files.
  Removed or changed page URLs are never acceptable.

## Where things live

| What | Where |
| --- | --- |
| Design tokens (colors, type scale, spacing, measure, widths) | `themes/bnm/assets/css/tokens.css` |
| Fonts (family, fallback, files, preload) | `hugo.toml` `[params.fonts.heading|body|mono]`; WOFF2 in `themes/bnm/static/fonts/<dir>/` |
| `@font-face` and `--font-*` generation | `themes/bnm/layouts/_partials/head/fonts.html` |
| CSS bundle order | `themes/bnm/layouts/_partials/head/css.html` |
| Code highlighting | `markup.highlight` in `hugo.toml` (class based), colors in `code.css` |
| Site params (menu, analytics, giscus, home) | `hugo.toml` `[params]` |
| Home: Latest count (`[params.home] latest`), Featured (`featured = true` front matter), Projects (`[[params.projects]]`, max 5, hidden when empty) | `hugo.toml`, `themes/bnm/layouts/home.html` |
| Article grid and its single breakpoint (77.5rem, derivation in the comment) | `themes/bnm/assets/css/layout.css` |
| TOC, footnotes, sidenotes, autonumber styles | `themes/bnm/assets/css/article.css` |
| Article JS (bundled, minified, fingerprinted in `single.html`) | `themes/bnm/assets/js/{toc,footnotes,code}.js` |
| Code block markup (border label) / math fences (`transform.ToMath`) | `themes/bnm/layouts/_markup/render-codeblock{,-math}.html` |
| KaTeX stylesheet (pinned, SRI; only on pages with math) | `themes/bnm/layouts/_partials/math.html` |

Article front matter: `toc = true` (optional `tocDepth = 1|2|3`, levels below h2, default 2),
`autonumber`, `readTime`, `showTags`, `math = true` (opt-in client-side `$...$` rendering; not needed
for ```` ```math ```` fences, which render at build time), `hidePagination`, `hideBackToTop`.

The breakpoint is written only in CSS (media queries cannot read custom properties). JS reads the
layout's `--wide` custom property instead of repeating it. If the body size, measure, `--toc-width`,
`--note-width`, `--gutter` or `--page-pad` change, recompute it (formula in `layout.css`) and update
both `@media (min-width: 77.5rem)` rules (`layout.css`, `article.css`).

## Typography spec

- Design body text first: font, size, line height, measure. Everything else is
  built around it.
- Body size: 17-20px (judge by eye per font, since apparent size differs between
  fonts).
- Line height: 1.20-1.45 x font size. Start near 1.5 only if the font looks
  small, otherwise 1.4.
- Measure: 45-90 characters per line including spaces. Verify at 1024, 1440 and
  1800px. The article column must never stretch past this, even with sidebars
  hidden.
- Paragraphs: spacing OR first-line indent, never both. Use spacing, 50-100% of
  font size.
- Headings: 2 levels preferred, 3 maximum visually distinct. Smallest size jump
  that works plus whitespace above and below. No fixed-ratio scale, no all caps,
  no underline, no hyphenation.
- Fonts: at most two families (heading, body) plus mono, each with a defined
  role.
- Emphasis: bold OR italic, never both. Underline only for links.
- Caps and small caps: only for strings shorter than one line, with 0.05-0.12em
  letter-spacing. Never fake small caps. Kerning on.
- Alignment: left-aligned, ragged right, no justification. Centered text only
  for short titles.
- Body color: dark gray or near-black, not pure black.
- Numbers: tabular figures in tables and code, proportional in prose.
- Tables: whitespace and alignment before borders, light rules only, generous
  cell padding.
- Block quotes: slightly smaller, indented 2-5em, no quotation marks.
- Lists: small, subtle bullets.
- Enable Hugo's typographer (markup.goldmark.extensions.typographer) so Markdown
  quotes, apostrophes, dashes and ellipses render as proper characters. Verify
  nothing breaks in code blocks or existing content.
- Foreground vs background: body text and code are foreground. Dates, tags,
  footnote markers and TOC are quieter.
- Prefer whitespace over borders and boxes. Do not fill space just because it
  exists.
- Compare alternatives visually with screenshots before choosing. The eye
  decides, not the numbers.

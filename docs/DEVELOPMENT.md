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
| Callouts (blockquote hook; styles at the end of `article.css`, tones in `tokens.css`) | `themes/bnm/layouts/_markup/render-blockquote.html` |
| giscus theme CSS (served at `/giscus/bnm-3.css`) / comments widget | `themes/bnm/static/giscus/bnm-3.css` / `themes/bnm/layouts/_partials/comments.html` |
| KaTeX stylesheet (pinned, SRI; only on pages with math) | `themes/bnm/layouts/_partials/math.html` |

Article front matter: `toc = true` (optional `tocDepth = 1|2|3`, levels below h2, default 2),
`autonumber`, `readTime`, `showTags`, `math = true` (opt-in client-side `$...$` rendering; not needed
for ```` ```math ```` fences, which render at build time), `hidePagination`, `hideBackToTop`.

## Callouts

Hugo alert syntax in a blockquote. Types (case-insensitive): `NOTE`, `TIP`, `IMPORTANT`, `WARNING`,
`CAUTION`, plus the custom `UPDATE` and `CORRECTION` for edits made after publishing. Hugo's alert
parser accepts any `[!WORD]`, so custom types need no workaround; the hook only whitelists the seven
above and renders anything else (and plain `>` quotes) as an ordinary `<blockquote>`.

```md
> [!UPDATE] Fixed after publishing
> The query was missing `for update`; the code below is corrected.
```

The optional text after the type follows the label after a middle dot; the label always keeps the type
name. Output is `<aside class="callout callout-update" role="note">` with a real-text label. The label
is sentence case, capitalised in the hook (not by CSS), semibold at 0.9em with no letter-spacing; a
custom title is regular weight. Three tones: neutral
(note, tip), accent (important, update, correction), warn (warning, caution). Blocks, lists and
footnotes work inside; sidenotes are unaffected.

### Margin callouts

```md
> [!NOTE margin]
> A short aside beside the paragraph on wide screens.

> [!TIP margin] Optional title
> Titles work the same way.
```

Only NOTE and TIP can be margin callouts; the marker is accepted but ignored on the other types, which
always stay in the column. Hugo's alert parser only accepts `[!LETTERS]` (`[!NOTE margin]` and
`[!NOTE-MARGIN]` both fall through as plain blockquotes), so the hook parses the first line of
`.Text` itself. Other renderers show it as a plain blockquote.

The markup is the same aside plus a `callout-margin` class and is never duplicated or moved in the
DOM. At the 77.5rem breakpoint `js/footnotes.js` adds `is-margin` and offsets the aside into the notes
column, top-aligned with the block that follows it. It stacks with the marginal footnotes in order of
anchor, so nothing overlaps or sits above its anchor. Below the breakpoint, or without JS, it is an
ordinary in-column callout. A margin callout with code, a list, a table, an image or a footnote
reference, or longer than 8 lines at the margin width, stays in the column; under `hugo server`
(`data-dev` on the layout) the console warns when that happens.

The breakpoint is written only in CSS (media queries cannot read custom properties). JS reads the
layout's `--wide` custom property instead of repeating it. If the body size, measure, `--toc-width`,
`--note-width`, `--gutter` or `--page-pad` change, recompute it (formula in `layout.css`) and update
both `@media (min-width: 77.5rem)` rules (`layout.css`, `article.css`).

## Comments (giscus)

`[params.giscus]` in `hugo.toml` configures the widget. `theme` is the absolute URL of the CSS giscus
loads into its iframe, `https://bnmoch3.org/giscus/bnm-3.css`, served from
`themes/bnm/static/giscus/bnm-3.css`. It must be absolute (the iframe lives on giscus.app) and is the
same in every environment. If `theme` is empty the partial falls back to `noborder_light`.

`bnm-3.css` is giscus' `styles/themes/light.css` (same variables) recolored with the palette in
`tokens.css`, with the iframe's html/body/main background set to the exact page color
(`--beige-0`), muted text at 5.7:1 and accent links at 4.8-5.3:1. The iframe cannot see the page's
custom properties or fonts, so the values are copied into the file: update it when `tokens.css`
changes. Text is the system sans stack (`system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica
Neue", Arial, sans-serif`) at giscus' default sizes with line-height 1.5; only the "N reactions" and
"N comments" headings use Outfit, loaded by an `@font-face` with the absolute URL
`https://bnmoch3.org/fonts/outfit/outfit-latin-wght-normal.woff2` (same path as the page's own copy,
so it exists only after a deploy and needs CORS like the CSS; the fallback is the system stack).
Form controls and giscus' utility classes override inheritance, so `bnm-3.css` sets font-family and
line-height on them explicitly: re-inspect the iframe DOM if giscus changes its markup.

Caveats:

- **Deploy first.** The URL does not exist until the CSS is deployed, and giscus loads it from the live
  site, so until then comments render with giscus' unthemed default. To work on the widget before
  deploying, either set `theme = "noborder_light"`, or have Playwright serve the local file at the
  production URL: `page.route('https://bnmoch3.org/giscus/bnm-3.css', r => r.fulfill({path:
  'themes/bnm/static/giscus/bnm-3.css', contentType: 'text/css', headers: {'access-control-allow-origin':
  '*'}}))`. The real iframe then loads it.
- **CORS.** giscus requests the CSS with `crossorigin="anonymous"`, so the host must send
  `Access-Control-Allow-Origin` for it. Check this after the first deploy.
- **Caching.** The deploy matchers cache `*.css` for a year and the file is not fingerprinted. After
  editing it, rename it to the next number (currently `bnm-3.css`) and
  update `theme` in `hugo.toml` and the paths in this section, or visitors keep the old copy.
- Only the signed-out view was checked (reactions, comment box, sign-in button). Signed-in states,
  rendered comments, code blocks and reaction pickers are untested.

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

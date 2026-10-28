# Plan: redesign bnmoch3.org's Hugo theme as `themes/bnm`

## Status
- [x] Phase 1: audit, URL baseline, submodule detached, /blog/ aliases, fixture post (`8c24bd1`)
- [x] Phase 2: theme copy, tokens, fonts, dark mode removed (`f2b19f1`)
- [x] Phase 3: home and list pages, typography corrections, body font chosen (Source Serif 4)
- [x] Phase 4: article layout (TOC, footnotes, code blocks, math): one breakpoint at 77.5rem (three
  columns above, single column + collapsible TOC + footnote list below), `b0293e6`..`dd19b51`
- [ ] Phase 5: prune dead typo code
- [ ] Phase 6: verification

## Context
The live blog uses `themes/typo`, a git submodule of a typo fork. It has dark-mode leftovers, Literata/Monaspace fonts and several latent bugs:
- giscus reads `utteranc.category`, so `data-category` is empty.
- Simple Analytics is hardcoded and also loads in dev.
- KaTeX never loads, so the two ```` ```math ```` fences render as plain code.
- `svg.html` is dead (161 KB, never called).
- `head/js.html` builds a `main.js` that doesn't exist.
- `.Page.Scratch` is deprecated.

The goal is a light-only, warm, typographically careful theme with three columns: sticky TOC on the left, article in the middle, marginal footnotes on the right. All URLs stay byte-identical. Everything is configured from `hugo.toml` params plus `assets/css/tokens.css`. It uses plain CSS and JS, and standard (non-extended) Hugo must build it. Work happens on branch `blog-redesign`.

Audit facts that shape the plan:
- Content is 33 posts and 34 notes, all TOML page bundles. There is one draft (`posts/2026_01_pg_fsm_state_vs_event`).
- Front matter keys in use: `title, date, summary, tags, slug, type, toc (8 true), readTime, autonumber (1), showTags, featured (7), draft`. There is no `math`, `theme`, `aliases` or `url` anywhere.
- There are no footnotes and no mermaid fences. The only math is 2 ```` ```math ```` fences in `posts/2024_03_gls_facility_location_p3`.
- The site root has no `layouts/` or `assets/`, only favicons in `static/`.
- `/blog/<slug>/` exists only as stale files in `build/main`. **Decision (user):** add `aliases = ["/blog/<slug>/"]` to the front matter of the affected pages. This touches front matter only, never bodies.
- Hugo locally is v0.148.2+extended. Screenshots use `npx playwright` (browsers are cached in `~/.cache/ms-playwright`) because the Playwright MCP server failed to connect. Headless `google-chrome` is the fallback.

## Phase 1: Audit and URL baseline (commit: "Detach typo submodule, record URL baseline")
1. Build the baseline before any change: `hugo --minify -d $SCRATCH/base`, then `find . -type f | sort > $SCRATCH/urls-base.txt` (kept outside the repo).
   - Also save a normalized feed and sitemap: `index.xml`, `sitemap.xml`, and every `*/index.xml` with `<lastBuildDate>` stripped.
   - Also save `<link rel=canonical>` and `og:url` extracted from every HTML file.
2. Write the diff script `$SCRATCH/urldiff.sh`. It rebuilds to `$SCRATCH/cur`, then diffs the path lists, sitemap `<loc>`s, RSS `<link>`s and canonical/og:url values. It is rerun after every phase.
3. Detach the submodule:
   - `git rm --cached themes/typo` and delete the `[submodule "themes/typo"]` entry from `.gitmodules`. `build/main` stays untouched.
   - `rm -rf .git/modules/themes/typo` (after confirming the path), then `git add themes/typo` as plain files, without its `.git`.
4. Legacy aliases:
   - List `build/main/blog/*/` slugs. For each one that matches a current slug, add `aliases = ["/blog/<slug>/"]` to that bundle's front matter.
   - Report slugs with no match (old renames) rather than guessing.
   - The expected diff is additions only, under `/blog/`.

## Phase 2: Theme copy, tokens and fonts (commit per phase)
1. `cp -r themes/typo themes/bnm`. In `hugo.toml`, set `theme = 'bnm'` and pin `[module.hugoVersion] min = "0.148.0"`. Set `theme.toml` to `min_version 0.148.0`, `extended = false`.
2. Move to the v0.146+ layout tree: `layouts/baseof.html`, `home.html`, `list.html`, `single.html`, `taxonomy.html`, `404.html`, `_partials/`, `_markup/`.
3. CSS, in `themes/bnm/assets/css/`, concatenated in this order:
   - `tokens.css`: the only file with raw values. It holds colors from the Tania palette, spacing scale, measure (`--measure: 68ch`), widths (`--toc-w`, `--note-w`), radii, font tokens and code token colors.
     - Colors: bg `#f8f4e6`, surface `#f1ead5`, surface-2 `#ece4ca`, border `#e5dcbd`/`#c6ba93`, text `#28282e`, heading `#1d1d22`, muted `#5a5a61`, accent `#b26a34`.
     - Before use, the accent's contrast on the beige background will be checked against WCAG AA (≥4.5) and darkened if needed.
   - `base.css`, `layout.css`, `components.css`, `article.css`, `code.css`, `print.css`.
   - All are concatenated with `resources.Concat | minify | fingerprint` (no Sass), using native nesting and Grid.
   - Delete Typo's `reset.css`, `vars.css`, `utils.css` and `colors/` (folded or dropped).
4. Fonts from params. Add `[params.fonts.heading|body|mono]` to `hugo.toml` with `family`, `fallback`, and `files = [{file, weight, style}]`.
   - A partial `_partials/head/fonts.html` generates the `@font-face` CSS with `resources.FromString` | `resources.ExecuteAsTemplate`, so it joins the same bundle.
   - It also emits `--font-heading/body/mono` and `<link rel=preload>` for the body regular weight.
   - WOFF2 files go in `themes/bnm/static/fonts/<family>/`. Download from the Fontsource/Google Fonts CDN:
     - Outfit variable.
     - Work Sans variable, plus the italic variant.
     - Google Sans Code variable, plus italic.
   - Compare Google Sans Code with Monaspace Argon in a code screenshot and keep the better one. Default is Google Sans Code; Monaspace is only kept if it clearly wins.
   - Delete Literata.
5. Remove dark mode:
   - The body-class script in `baseof`.
   - `.dark` vars and palette switching (`colorPalette`, `theme` params).
   - `img-light`/`img-dark` CSS.
   - The `render-image` hook keeps the generic `#class` fragment → class feature but drops the theme-specific rules.
   - Remove `theme`/`colorPalette` from `hugo.toml`.
   - Add `color-scheme: light`.
6. Fixes made along the way:
   - giscus reads `giscus.category`.
   - Simple Analytics goes behind `params.simpleAnalytics.enable` and production only, so it stays on in production.
   - Use the GA/umami partials' production gating via `hugo.IsProduction`.
   - Replace `.Scratch`.
   - Fix the `render-image` `$imgResource` shadowing bug.
   - Delete `head/js.html`.

## Phase 3: Home and list pages
- **Header:** the site name in the heading font, nav from `params.menu` with `aria-current="page"` on the active section (replacing the broken `.Page.Name` check), and a skip link.
- **Home** (`home.html`), keeping hugo-tania's hierarchy. All data comes from params or content:
  1. **Intro:** `homeIntroTitle`, `homeIntroContent` (markdownified), plus optional `params.social` links.
  2. **Latest:** keep the current logic (5 posts + 3 notes, merged, newest first) but make the counts params. Rows show a mono date, the title, a "note" chip for notes and an optional summary. "All posts →" links to /posts/ and "All notes →" to /notes/.
  3. **Featured:** pages where `.Params.featured` is true, shown as cards with title, summary and date.
  4. **Projects:** rendered only when `[[params.projects]]` exists (name, description, url, repo). The template supports it, but no entries are added.
  5. **Archives:** links to posts, notes and tags with counts.
- **list.html** (sections and tag terms):
  - Group by year with `GroupByDate "2006"`, rows with a date column.
  - Keep `.Paginate` and `paginationSize` (100) so `/page/N/` paths stay the same.
- **`taxonomy.html`:** a dedicated layout for `/tags/`. A tag cloud and list with counts, sorted by count, replacing the `eq .Title "Tags"` hack.
- **Pagination controls** use `rel=prev/next`.

## Phase 4: Article layout
- **Grid** in `single.html`: `.article-grid` with columns `[toc] [main: minmax(0, var(--measure))] [notes]`.
  - ≥1400px (exact value tuned from screenshots), with TOC or footnotes: three columns. TOC is sticky on the left, notes on the right.
  - 1100–1400px: two columns, either TOC + article, or article + notes when there is no TOC. When both exist, notes fall back to the list and the TOC stays.
  - <1100px: one column. The TOC becomes a `<details>` block above the article, footnotes stay at the bottom, and the article column never shrinks below its measure.
- **TOC:** `.Param "toc"` (unchanged), plus an optional `tocDepth` (default 3). Configure `markup.tableOfContents` with startLevel 2 and endLevel 4, and filter by depth in CSS via a `data-depth` attribute on the nav.
  - `assets/js/toc.js` is plain JS, bundled with `js.Build` (esbuild ships in standard Hugo) or just minify + fingerprint.
  - It uses an IntersectionObserver with `rootMargin: "0px 0px -80% 0px"`, following `useActiveHash`. It tracks the last heading that crossed the line so scrolling up works too, sets `aria-current` on the active link, and calls `scrollIntoView({block:'nearest'})` inside the sidebar.
  - `autonumber` stays: CSS counters on h2–h4, applied to the TOC too.
- **Marginal footnotes:** `assets/js/footnotes.js`, ported from hugo-tania and fixed.
  - It does not delete or move the `.footnotes` list. It clones each `li` into an `<aside class="sidenote">` in the notes column, and keeps reference hrefs so clicking still works.
  - Positioning is measured in JS: each note's top is the ref's offsetTop relative to the grid, and is then pushed down to at least the previous note's bottom plus a gap, so notes never overlap.
  - The `.footnotes` list is hidden only while sidenotes are active (`html.has-sidenotes`, toggled by `matchMedia` on the wide breakpoint). It re-lays out with a ResizeObserver and after `document.fonts.ready`.
  - Without JS, or on narrow screens, the standard list shows.
  - Hovering a ref highlights its sidenote, and the reverse.
- **Code blocks:**
  - `markup.highlight noClasses = false`. Generate `chroma.css` with `hugo gen chromastyles`, then hand-map token classes (`.k .s .nf .m .c .o .p .nb .kt .na .nt .err`, …) to New Moon light values in `code.css`: string `#728400`, keyword `#b8266d`, function `#118b81`, number `#b54110`, comment `#5c7179`, operator `#785200`, tag `#268bd2`, class `#c32c75`, attribute `#916f14`, punctuation `#586e75`, error `#dc322f`. These are token variables in `tokens.css`.
  - New `_markup/render-codeblock.html`:
    - Wraps `transform.Highlight` in `<figure class="code" data-lang>`.
    - A small language label sits in the top-right corner as an absolutely positioned overlay on the figure, not the scroller. It takes no vertical space.
    - A `<button class="copy">` (aria-label, visible on focus and touch, with a "Copied" state).
    - The inner `pre` scrolls horizontally.
    - Language names are normalized to lowercase (`Go`, `C`, `Minizinc`).
  - This fixes hugo-tania's issues: the label no longer scrolls, there's no padding gap when there's no language, the button works on touch, and line-number tables are styled correctly.
  - Inline code gets a subtle surface background, a 0.9em mono font and padding, and never inherits block styles.
- **Math:** `_markup/render-codeblock-math.html` uses `transform.ToMath` (server-side KaTeX, which works in standard Hugo) in display mode and sets `.Store "hasMath"`. KaTeX CSS is then loaded only on those pages. The existing `math` param and the CDN auto-render partial are kept for inline `$…$`, with a pinned version.
- **Mermaid:** keep the render hook and pin the mermaid version.
- **Other:** giscus, read time, `showTags` and prev/next stay. The giscus theme becomes `light`, or a custom CSS URL later; `noborder_light` is the closest match to beige. Hover anchor links on headings stay.
- **Test fixture:** the draft post `content/posts/zz_layout_fixture/index.md` is added in phase 1 (`draft = true`, never published). It has a long TOC (h2–h4, `toc = true`, `autonumber = true`), ~12 footnotes (some clustered close together), and code in several languages (sql, python, go, rust, bash, javascript, json), including wide lines and a `math` fence. It is used for screenshots via a `hugo -D -d <scratch>` build (never `hugo server` without `--renderToMemory`).

## Phase 5: Prune
- Delete the typo assets that are no longer used: `colors/*`, Literata, Monaspace (if not kept), `utils.css`, `custom.css`, `head/js.html`, the unused `svg.html` branches, and dead CSS such as `.social-icons` and `.img-dark`.
- `_partials/svg.html` keeps only the icons referenced by `params.social` in `hugo.toml` (e.g. github, rss, email). If `params.social` isn't added, delete the file.
- Grep every CSS selector against the built HTML and JS (a script in the scratch dir) to confirm each rule is used.
- `rm -rf themes/typo` and drop the typo favicons duplicated in the root `static/`.
- The final summary lists everything that was removed.

## Phase 6: Verification
- Run `urldiff.sh`. The path set must equal the baseline, plus the `/blog/*` alias pages, plus fingerprinted asset names (hash changes are expected and listed). RSS and sitemap `<loc>` and canonical/og:url values must be identical.
- Run `hugo --minify` with a non-extended Hugo binary: download the standard `hugo_0.148.2_linux-amd64.tar.gz` to the scratch dir and build with it.
- Screenshots: a Node script in the scratch dir runs `npx playwright` Chromium against `hugo server -D`. Viewports are 390, 1024, 1440 and 1800 wide, full page. Output goes to `$SCRATCH/shots/`. Pages:
  - home
  - `/tags/postgresql/` (or the largest tag)
  - the long TOC post `/p/<row-level-security slug>/`, which has 65 code blocks, TOC and autonumber
  - the footnote fixture
  - the code-heavy `posts/2023_07_duckdb_json_wrangling`
  - `/404.html`
  - the print stylesheet, rendered with `page.pdf`
- Visual problems found in the screenshots are fixed before each phase's commit.
- Checks:
  - Keyboard focus visible (`:focus-visible` outline in the accent color).
  - `prefers-reduced-motion` disables smooth scroll and transitions.
  - Print hides nav, TOC, giscus and copy buttons, shows link URLs, and inlines footnotes as a list.
  - A 404 page with links home, posts, notes and tags.
  - OG and canonical tags present (`partial "opengraph.html"`, `twitter_cards.html`).
- Write `CLAUDE.md` at the repo root covering:
  - The `make dev`, `hugo --minify` and `make build-dev` commands.
  - The pinned Hugo version (0.148.x, standard edition is enough).
  - No Sass, no Node, no Tailwind.
  - The URL stability rule and how to run the diff.
  - Tokens live in `themes/bnm/assets/css/tokens.css`, fonts in `hugo.toml [params.fonts]`.
  - Never touch `build/main` or `misc/`.

## Process gates
- Commit after each phase on `blog-redesign`, with no pushing unless asked.
- After each phase: post a short summary with screenshot paths, then **stop until the user says "continue"**.

## Uncertainties to report at the end
- Which slugs under `/blog/` don't match a current slug.
- The final breakpoints.
- The Google Sans Code vs Monaspace choice.
- The giscus theme on beige.
- The math rendering change for the facility_location_p3 post: it goes from plain code to rendered math.

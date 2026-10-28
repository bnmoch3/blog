# Practical Typography: Universal Design Master Reference

> **Source:** Synthesized and paraphrased from Matthew Butterick's _Practical
> Typography_, including the site's main chapters, summary rules, page-layout
> guidance, font recommendations, sample-document studies, and screen/responsive
> guidance.
>
> **Purpose:** Tool-agnostic master reference for generating
> environment-specific typography rules for documents, websites, presentations,
> plots, dashboards, tables, reports, and PDFs.
>
> **Interpretation note:** This reference preserves Butterick's stated numerical
> recommendations where available. It deliberately avoids translating them into
> engine-specific syntax. It also distinguishes hard rules from judgment calls
> and from clearly labeled inferences.
>
> **Important numerical correction:** Butterick's recommended average body-text
> line length is **45–90 characters including spaces**. The often-cited **45–75
> characters, with about 66 optimal**, convention is associated with Robert
> Bringhurst's _The Elements of Typographic Style_ and should **not** be
> attributed to _Practical Typography_.[^1]

---

# LLM SYSTEM PROMPT QUICK-REFERENCE

> Full citations and rationale for every rule below appear in the detailed
> reference that follows.

## Body text parameters

- Design body text first: **font, point size, line spacing, line length**.
- For ordinary print body text, start at **10–12 pt**.
- For ordinary screen body text, start at **15–25 px equivalent apparent size**.
- For most body text, use **120–145% line spacing**.
- Keep average body-text line length at **45–90 characters including spaces**.
- Judge apparent size visually: equal nominal sizes can look different across
  typefaces.
- As body text becomes smaller, shorten the line length and reduce absolute line
  spacing proportionally.
- For unusually large display text, tighter proportional leading can be
  appropriate, but no universal Butterick percentage is specified; judge it
  optically.

## Punctuation & composition

- Use curly opening and closing quotation marks for quotations.
- Use the typographic apostrophe for contractions and possessives.
- Use **one** word space after sentence-ending punctuation.
- Distinguish hyphen, en dash, and em dash by function; never fake a dash with
  repeated hyphens.
- Use the dedicated ellipsis character rather than hand-built spaced periods.
- Use real multiplication, division, minus, copyright, trademark,
  registered-mark, and other symbols where applicable.
- Bind paragraph/section marks to their following numbers with nonbreaking
  space.
- Do not hyphenate web or email addresses.

## Caps, small caps & spacing

- Use all caps only for short strings, generally **less than one line**.
- Add approximately **5–12% extra letterspacing** to all caps and small caps.
- Keep kerning enabled.
- Use real designed small caps; never synthesize them by shrinking full
  capitals.
- Do not routinely add tracking to lowercase body text.

## Paragraphs & pages

- Separate paragraphs with **first-line indentation OR paragraph spacing, never
  both**.
- First-line indent: **1–4 × body-text size**.
- Paragraph gap: approximately **50–100% of body-text size**, commonly **4–10
  pt**.
- At 12 pt on a conventional printed page, side margins around **1.5–2 in**
  often produce a comfortable line length; line length, not the margin number
  itself, is the governing constraint.
- Use centered text sparingly.
- Justify only when hyphenation is active.
- Avoid isolated first or final paragraph lines at page/column edges when they
  create a visible problem; Butterick treats widow/orphan control as
  discretionary rather than mandatory.

## Tables & numeric data

- Align quantities by numerical meaning, not merely by cell boundary.
- Align decimal quantities on the decimal point when appropriate.
- Use tabular figures for vertically aligned numeric columns.
- Prefer proportional figures in running prose.
- Use lining figures with all-caps contexts; old-style figures can blend better
  with lowercase prose.
- Do not append meaningless zeros merely to force visual alignment.
- Use whitespace and alignment before borders; minimize decorative gridlines.

## ALWAYS

- **ALWAYS** design for the reader.
- **ALWAYS** start with body text.
- **ALWAYS** keep line length in the readable range.
- **ALWAYS** preserve typographically correct characters.
- **ALWAYS** enable kerning where available.
- **ALWAYS** use consistent semantic roles for repeated elements.
- **ALWAYS** compare plausible alternatives visually.
- **ALWAYS** test typography in its final viewing context.

## NEVER

- **NEVER** use both paragraph indents and paragraph spacing as the ordinary
  paragraph-separation system.
- **NEVER** use repeated spaces as a layout mechanism.
- **NEVER** justify prose without hyphenation.
- **NEVER** fake small caps.
- **NEVER** set long paragraphs in all caps.
- **NEVER** use bold italic merely to intensify emphasis.
- **NEVER** add decoration merely because unused space remains.

---

## 1. Core Principles & Mindset

### 1.1 Typography is the visual component of written language

Typography encompasses every decision affecting how written language is visually
presented: font, size, spacing, alignment, punctuation, hierarchy, positioning,
and the relationships among those elements.

It is not synonymous with “choosing a font.”[^2]

### 1.2 Typography serves the reader

- **Rule:** Optimize typography for the reader rather than the author.
- **Rationale:** The writer already knows the content, has high interest in it,
  and is willing to devote substantial attention to it. The reader generally has
  less interest, less time, and more alternatives.
- **Design consequence:** Reduce friction. Make hierarchy obvious. Make the text
  easy to enter, navigate, skim, and resume.
- **Anti-pattern:** Designing around what looks exciting to the creator rather
  than what helps the audience understand the material.[^3]

### 1.3 Reader attention is finite

Typography should conserve reader attention.

Good typography allows attention to flow toward the message rather than being
consumed by decoding the presentation. Bad typography makes readers spend
cognitive effort overcoming cramped spacing, unclear hierarchy, inconsistent
positioning, distracting decoration, or poorly formed text.[^4]

### 1.4 Good typography reinforces meaning

- **Rule:** Judge a typographic solution by whether it strengthens the meaning
  and function of the text.
- **Not by:** novelty, prettiness, fashion, mathematical elegance, or adherence
  to a template.
- **Consequence:** Different documents legitimately require different
  typography.
- **No single correct solution:** Several distinct typographic systems can solve
  the same communication problem successfully.

Typography is primarily utilitarian. A beautiful treatment that interferes with
communication fails; an aesthetically modest treatment that communicates
exceptionally well succeeds.[^5]

### 1.5 Substance and typography interact

When readers cannot easily judge documents on substance—because they have
limited time, little prior knowledge, or many competing documents—visual
presentation becomes proportionally more influential.

Therefore:

- skim-heavy contexts require particularly strong hierarchy;
- resumes, slides, dashboards, reports, tables, and interfaces cannot rely on
  readers carefully inspecting every detail;
- typography should make important distinctions visible before detailed reading
  begins.[^4]

### 1.6 Professional output deserves professional typography

There is no separate lower standard for “business,” “academic,” “technical,”
“legal,” or “office” typography. Contemporary digital tools can produce
typography approaching professional publishing quality, so inherited typewriter
conventions should not automatically dictate modern design.[^6]

### 1.7 Start with body text

The appearance of a text-heavy document is dominated by its body text because
body text occupies the greatest area.

Therefore establish these four variables first:

1. **Font**
2. **Point size**
3. **Line spacing**
4. **Line length**

Only after the body text works should secondary elements—titles, headings,
captions, notes, callouts, tables, legends, labels—be designed around it.[^7]

---

## 2. Master Numerical Reference

| Parameter                              |                                                                                                                                           Butterick-derived recommendation |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| Print body-text size                   |                                                                                                                                                               **10–12 pt** |
| Screen/web body-text size              |                                                                                                                                      **15–25 px equivalent apparent size** |
| Body-text line spacing                 |                                                                                                                                                  **120–145% of text size** |
| Large-display leading                  | **No universal Butterick percentage; proportionally tighter leading may be appropriate as a working optical adjustment, but must not be treated as a sourced numeric law** |
| Small-text leading                     |                       **Reduce absolute leading as size decreases; maintain enough separation to prevent merging. Butterick gives no separate universal percentage band.** |
| Average line length                    |                                                                                                                                      **45–90 characters including spaces** |
| First-line paragraph indent            |                                                                                                                                                        **1–4 × text size** |
| Paragraph spacing                      |                                                                                                               approximately **50–100% of text size**, commonly **4–10 pt** |
| Extra tracking for all caps            |                                                                                                                                                     **5–12% of text size** |
| Extra tracking for small caps          |                                                                                                                                                     **5–12% of text size** |
| Example 12-pt cap tracking             |                                                                                                                                               approximately **0.6–1.4 pt** |
| Block-quote side indent, print         |                                                                                                                                                 approximately **0.5–1 in** |
| Block-quote side indent, relative      |                                                                                                                                                   approximately **2–5 em** |
| Standard-page side margins near 12 pt  |                                                                                                                   often approximately **1.5–2 in**, subject to line length |
| Columns on 8.5 × 11 in page            |                                                                                                                                             **2–3 reasonable; 4 too many** |
| Business-card text                     |                                                                                                                               often **6–8 pt** when professionally printed |
| Heading levels                         |                                                                                                                              preferably **2**, maximum approximately **3** |
| Typical heading size increment         |                                                                                        use smallest visible increase; e.g. **12 → 12.5 or 13 pt**, not automatically 14–15 |
| Presentation sizing test               |                                                                                                             base size that would permit roughly **12–15 lines** on a slide |
| Initial slide foreground gray on black |                                                                                             Butterick suggests starting near **50% gray**, then brightening only as needed |
| Initial table cell padding experiment  |                                                                                                                approximately **0.03 in**, adjust in **0.01 in** increments |
| Widow/orphan control                   |                                                    **Discretionary in Butterick; avoid visible isolated lines, but he does not state a universal “minimum two lines” law** |

These values are ranges, not automatic formulas. Apparent font size, line width,
medium, viewing distance, weight, and content density all alter the final
judgment.[^8]

---

## 3. Type Composition & Punctuation

### 3.1 Curly quotation marks

- **Rule:** Use typographic opening and closing quotation marks rather than
  typewriter-style straight quotation marks.
- **Rationale:** Opening and closing marks are distinct punctuation characters
  with shapes designed to work with proportional typography.
- **Anti-pattern:** Using straight vertical marks as quotation marks merely
  because they are easier to type.
- **Exception:** Straight marks have legitimate non-quotation functions,
  including foot and inch notation.[^8]

### 3.2 Sentence spacing

- **Rule:** Use **one word space between sentences**.
- **Rationale:** Double spacing is a typewriter-era convention, not a
  requirement of proportional typesetting.
- **Anti-pattern:** Two or more spaces following terminal punctuation.
- **Implementation principle:** Sentence boundaries should be communicated by
  punctuation, not manually widened whitespace.[^9]

### 3.3 Hyphens, en dashes, and em dashes

Treat these as distinct characters with distinct functions.

#### Hyphen

Use the hyphen primarily inside compound words or constructions requiring a
hyphen.

#### En dash

Use an en dash where the meaning is fundamentally a relationship, connection, or
range when the applicable editorial convention calls for one.

#### Em dash

Use an em dash as sentence punctuation when a strong interruption or break is
intended.

- **NEVER:** approximate a dash with repeated hyphens.
- **Rationale:** A hyphen is not a shorter form of an em dash; they are separate
  punctuation marks with separate typographic roles.[^10]

### 3.4 Ellipsis

- **Rule:** Use the dedicated ellipsis character when an ellipsis is required.
- **Anti-pattern:** Constructing an ellipsis from three periods separated by
  manually inserted spaces.
- **Rationale:** The dedicated glyph provides controlled internal spacing and
  behaves as one typographic character.[^11]

### 3.5 Apostrophes

- **Rule:** Use the typographic apostrophe.
- **Recognition principle:** The apostrophe has the form of a closing single
  quotation mark and points downward.
- **Anti-pattern:** substituting a straight vertical tick.[^12]

### 3.6 Foot and inch marks

Foot and inch marks are **straight marks**, not curly quotation marks.

Correct typography therefore requires distinguishing measurement marks from
quotations rather than applying one style indiscriminately.[^13]

### 3.7 Paragraph and section symbols

When a paragraph mark or section mark is followed by a number, keep the symbol
and number together.

- **Rule:** Insert a nonbreaking space between the mark and its identifier.
- **Rationale:** A line break that separates the symbol from its number destroys
  the visual and semantic unit.[^8]

### 3.8 Ampersands

- **Rule:** Use `&` sparingly in prose.
- **Strong exception:** Preserve it when it belongs to a proper name or
  established label.
- **Rationale:** An ampersand is visually distinctive and can attract more
  attention than an ordinary conjunction.
- **Anti-pattern:** replacing every occurrence of “and” with an ampersand for
  decoration.[^8]

### 3.9 Trademark and copyright marks

Use actual typographic symbols rather than alphabetic approximations.

Typography should preserve the semantic distinction between a symbol and letters
that merely resemble its name.[^8]

### 3.10 Question and exclamation marks

Use expressive punctuation with restraint.

Butterick's deliberately memorable rule is that in a document longer than three
pages, **one exclamation point is plenty**.

The broader principle is more important than the literal quota: emphasis loses
force when overused.[^8]

### 3.11 Whitespace characters

Whitespace characters have semantic jobs.

- ordinary word spaces separate words;
- nonbreaking spaces bind units that should stay together;
- tabs position material relative to tab stops;
- paragraph breaks separate paragraphs;
- line breaks break lines without necessarily creating new paragraphs;
- page breaks separate pages.

**NEVER use repeated spaces as a layout system.**

Repeated spaces are unstable because proportional characters do not share fixed
widths and because reflow changes their visual effect.[^14]

### 3.12 Tabs

Tabs are alignment devices, not substitutes for arbitrary groups of spaces.

Use a small, deliberate collection of alignment positions to establish invisible
vertical structures in text such as metadata blocks, labels, dates, or numeric
columns.

The governing principle is: **align to positions, not to guessed quantities of
whitespace.**[^15]

### 3.13 Accented characters

Use the actual accented character required by the language or name.

Do not remove diacritics merely because the basic keyboard makes them
inconvenient to enter.

Correct character selection is part of typography, not optional decoration.[^8]

### 3.14 OpenType & micro-typography

OpenType features allow a font to carry alternate glyphs and substitution rules.
Their usefulness depends on two independent conditions: the font must contain
the feature, and the rendering environment must support it.[^16]

#### Ligatures

- **Rule:** Ligatures are optional unless two characters visibly collide;
  Butterick specifically calls out problematic `f` combinations as the practical
  case to inspect.
- **Rationale:** Ligatures originated as solutions to letter collisions. Digital
  fonts remove the metal-type constraint, but visual collisions can remain.
- **Anti-pattern:** Turning decorative ligatures into a stylistic gimmick in
  ordinary body text.[^17]

#### Small caps as a real font feature

True small caps are separately designed glyphs, sometimes provided as an
OpenType feature. They should match the surrounding text in stroke weight and
visual color rather than looking like shrunken capitals.[^18]

#### Alternate figures

- **Lining figures:** generally align at the top and bottom and are preferred in
  all-caps settings.
- **Old-style figures:** vary in height and depth and often blend well with
  lowercase prose; do not use them with all-caps text.
- **Tabular figures:** have fixed advance widths and are essential for
  vertically aligned columns of numbers.
- **Proportional figures:** have widths suited to their shapes and are generally
  preferable inside running prose.
- **Important distinction:** lining/old-style and tabular/proportional are
  separate axes; a font may provide several combinations.[^19]

#### Contextual alternates and stylistic sets

Butterick's OpenType overview explains that OpenType can supply alternate
letterforms and rules for inserting them, and he notes stylistic-set support in
some applications.[^16] **He does not provide a dedicated general rule for
contextual alternates in the book.** Therefore the safe tool-agnostic principle
is: activate optional alternates only when they solve a clear compositional
problem or serve a deliberate stylistic role; do not assume that every available
OpenType feature should be enabled.

#### Ordinals

- **Rule:** Do not automatically shrink ordinal suffixes such as `st`, `nd`,
  `rd`, and `th` into generic superscripts.
- **Rationale:** Automatically superscripted ordinals are often too small to
  read comfortably.
- **Exception:** If a professional font contains specially drawn superior
  letters and figures designed to remain legible, those may be used; that is
  different from mechanically shrinking normal characters.[^20]

#### Metrics vs. optical spacing

- **Metrics spacing:** uses the widths and kerning information built into the
  font by its designer.
- **Optical spacing:** replaces that information with an algorithmic estimate.
- **Butterick's rule:** use metrics spacing by default; treat optical spacing as
  an emergency option for a badly spaced font or a font being used beyond its
  intended size/function.
- **Rationale:** Good type design includes the design of white space, not only
  black letterforms. Replacing the designer's spacing can make text uneven,
  especially at ordinary reading sizes.[^21]

### 3.15 Web and email addresses

- **Rule:** Do not hyphenate web or email addresses.
- **Rationale:** Readers can mistake an inserted hyphen for part of the address.
- **Line breaking:** When a long address must wrap in a static document, choose
  breakpoints that do not introduce ambiguous punctuation into the address.
- **Print treatment:** Automatic blue-underlined hyperlink styling is not
  inherently useful in a document intended for print; visible link styling
  should serve the medium and function.
- **Practical hierarchy:** If a raw URL is excessively long and readers are
  expected to type it, consider whether the full address belongs in a note or
  whether a more usable stable reference can be provided.[^22]

### 3.16 Emoji and emoticons

Butterick addresses this topic directly rather than leaving it as an inference.

- **Rule:** Emoji and emoticons are acceptable in casual email or text
  communication but inappropriate in non-casual documents such as résumés.
- **Rationale:** They are shorthand for tone and authorial intent; overuse
  becomes as distracting as excessive punctuation or all caps.
- **Cross-platform caution:** Emoji can render differently across devices and
  platforms, so they should not carry subtle or mission-critical meaning by
  themselves.[^23]

---

## 4. Text Formatting

### 4.1 Body-text point size

#### Print

Butterick's default range for ordinary printed body text is:

**10–12 pt**

He specifically encourages trying intermediate sizes such as 10.5, 11, or 11.5
rather than treating whole-point values as sacred.[^24]

#### Screen

A useful target for ordinary screen body text is:

**15–25 pixels in apparent rendered size**

The exact value depends strongly on the font and expected viewing distance.[^24]

#### Generalized rule

Do not infer visual size from the numerical value alone.

Two fonts rendered at the same nominal size can appear substantially different
because their glyphs occupy different proportions of the font's em square.
Compare fonts visually using the same text and similar line breaks.[^24]

#### Scaling relationships

When body text becomes smaller:

- reduce line length;
- usually reduce absolute line spacing;
- preserve enough openness for lines to remain visually distinct.

Small type can remain comfortable when paired with shorter measures and
appropriately compact leading.[^24]

### 4.2 Line spacing

**Recommended body-text range: 120–145% of text size.**

In formula form:

`line height ≈ font size × 1.20 to 1.45`

Example:

- 10-unit text → approximately 12–14.5 units
- 12-unit text → approximately 14.4–17.4 units
- 16-unit text → approximately 19.2–23.2 units

- **Too tight:** lines visually collide and vertical tracking becomes difficult.
- **Too loose:** individual lines stop feeling like parts of one paragraph.
- **Rule:** evaluate line spacing together with size and line length, never in
  isolation.[^25]

#### Point-size ↔ leading relationship

Butterick explicitly states that as point size is reduced, line spacing and line
length should also be reduced, and he notes that fonts with a smaller apparent
size generally need less absolute line spacing.[^24][^25]

For large display type, **Butterick does not state a universal
inverse-percentage formula**. A useful working inference is that very large
headings can often tolerate proportionally tighter leading than body text
because the glyphs themselves create more visual separation. Treat that as an
optical adjustment, not as a quoted rule.

**Worked example — inference, not a Butterick numeric prescription:** if body
text at a given design uses **145%** leading, a large multi-line display heading
might be tested around **110–120%** and then adjusted by eye. The **110–120%**
range is not stated by Butterick and should never be presented as one of his
fixed parameters.

At the small end, Butterick's sourced instruction is to reduce **absolute**
spacing together with size and line length. Do not infer that fine print must
use a mechanically larger percentage in every font; preserve enough line
separation for legibility and judge the result visually.[^24][^25]

### 4.3 Line length

**Target average: 45–90 characters per line, including spaces.**

Butterick also offers a useful visual approximation: roughly **two to three
lowercase alphabets** should fit on a line.[^1]

### Rationale

Long lines increase horizontal eye travel and make it harder to find the
beginning of the next line.

Extremely short lines:

- fragment reading rhythm;
- generate excessive line breaks;
- produce awkward rags;
- increase dependence on hyphenation.

### Adjustment priority

Change the width of the text block first rather than repeatedly indenting
individual paragraphs.

For responsive layouts, verify the line length across viewport widths rather
than assuming a fluid container remains readable at every size.[^1]

### 4.4 Bold and italic

#### Fundamental rule

**Use bold or italic, not both simultaneously, and use either sparingly.**

- Roman text should carry most of the document.
- Emphasis should be exceptional.
- If too much material is emphasized, emphasis loses its meaning.[^26]

#### Serif text

- Italic → gentler emphasis.
- Bold → stronger emphasis.

#### Sans-serif text

Butterick generally prefers bold to italic for emphasis because many sans-serif
italics are only subtly slanted and therefore provide weak contrast.[^26]

#### Anti-patterns

- whole paragraphs in bold;
- bold italic;
- adding underline because bold was insufficient;
- progressively stacking emphasis methods.

Extremely heavy weights are generally more appropriate for display sizes than
continuous body text.[^26]

### 4.5 Underlining

**Default rule: do not underline text.**

The main modern exception is hyperlink treatment where underlining contributes
useful interaction semantics.

For ordinary emphasis, prefer:

- italic;
- bold;
- small caps where appropriate;
- spacing;
- position;
- heading structure.

Underlining is largely inherited from environments that lacked italic and bold
type.[^27]

### 4.6 All caps

#### Rule

**All caps are appropriate for less than approximately one line of text.**

Useful contexts include:

- short labels;
- running heads;
- brief titles;
- captions;
- small navigational labels;
- compact stationery information.

Do not set paragraphs or long headings in all caps.[^28]

#### Rationale

Lowercase text presents varied ascenders, descenders, and letter shapes. All
caps produce a more uniform rectangular texture and are less familiar in
continuous reading.

#### Required spacing

All-caps text should receive approximately:

**5–12% additional letterspacing**

and kerning should remain enabled.[^28][^29]

### 4.7 Small caps

Use **real designed small-cap glyphs**, not scaled-down full capitals.

Real small caps are drawn to harmonize with lowercase text in:

- height;
- stroke thickness;
- color;
- proportion.

Synthetic small caps tend to become too thin and visually weak because ordinary
capitals are merely shrunk.[^18]

#### Rules

- Use sparingly.
- Add approximately **5–12% letterspacing** unless the font already incorporates
  suitable spacing.
- Keep kerning enabled.
- If genuine small caps are unavailable, prefer another form of emphasis rather
  than fake ones.[^18][^29]

### 4.8 Letterspacing

#### Lowercase

Ordinary lowercase body text generally needs **no global added tracking**.

Fonts intended for body text are already spaced for reading sizes.

#### All caps and small caps

Add:

**5–12% of font size**

For 12-unit text, Butterick translates this to roughly **0.6–1.4 units** of
added space.[^29]

#### Optical exceptions

At very small sizes, slight positive tracking can prevent lowercase letters from
visually merging.

At very large display sizes, slightly tighter spacing can sometimes improve
cohesion.[^29]

#### Anti-pattern

Do not spread letters so far apart that the white gap between neighboring
letters could comfortably contain another letter.[^29]

### 4.9 Kerning

**ALWAYS enable kerning when available.**

Kerning corrects spacing between particular pairs of characters rather than
altering all letter pairs uniformly.

Treat kerning and tracking as different variables:

- kerning = pair-specific adjustment;
- letterspacing/tracking = global spacing adjustment.

Professional fonts include kerning information intentionally; disabling it
discards part of the type design.[^30]

### 4.10 Color

#### Print body text

**Use black for ordinary printed body text.**

Butterick treats this as a hard default. Colored body copy provides weak
emphasis at small sizes and often degrades print clarity.[^31]

#### Screen body text

Dark gray can be more comfortable than absolute black against a bright display
because emissive screens can produce harsher contrast than paper.[^31]

#### General color law

The perceived intensity of colored typography depends on:

- hue;
- brightness;
- font size;
- weight;
- amount of colored area.

Therefore:

**The larger or heavier the type, the less chromatic intensity it generally
needs.**

Small, thin text can tolerate stronger color than large, bold text.[^31]

#### Colored backgrounds

Use colored text on colored backgrounds cautiously.

Color should rarely become the sole mechanism for hierarchy.

#### Hyperlinks

Color is semantically associated with interactivity. Avoid using link-like
colors extensively on noninteractive text unless other cues eliminate ambiguity.[^31]

---

## 5. Headings & Hierarchy

### 5.1 Headings are navigation

Headings exist to reveal the structure of the argument and help readers orient
themselves.

They should not reproduce every level of an author's outline.

**Preferred hierarchy: 2 levels.\
Practical maximum: 3 levels.**[^32]

Too many levels cause readers to spend more effort decoding the hierarchy than
using it.

### 5.2 Heading emphasis should be economical

Recommended sequence:

1. add space above and below;
2. consider weight;
3. consider a modest size increase;
4. consider position or font change only if necessary.

Butterick specifically favors **space around headings** as one of the most
effective forms of emphasis.[^32][^33]

### 5.3 Heading size

Do not assume that a heading needs to be dramatically larger than body text.

Example given by Butterick:

If body text is **12 pt**, first try **12.5 or 13 pt**, rather than
automatically jumping to 14–15 pt.[^32]

More generally:

**Use the smallest size increase that creates the required perceptual
distinction.**

Large display headings are a choice, not a prerequisite.

### 5.4 Heading leading

Butterick's heading guidance emphasizes restrained size differences and
whitespace rather than large type by default.[^32] His general line-spacing rule
remains **120–145% for most text**.[^25]

For genuinely large, multi-line display headings, proportionally tighter leading
can be a useful optical adjustment. **No direct Butterick source specifies a
universal 110–120% heading range.** If that range is used as a starting
experiment, label it as an inference and tune by eye rather than treating it as
a book-derived constant.

### 5.5 Avoid exponential heading scales as doctrine

Butterick rejects the idea that heading sizes must automatically follow a
recurring mathematical ratio.

A modular scale can be a design aid, but it is not evidence that the resulting
hierarchy is good.

**Visual function outranks mathematical purity.**[^32]

### 5.6 Heading anti-patterns

Avoid:

- all caps for sentence-length headings;
- routine Title Case merely because something is a heading;
- underlining;
- unnecessary centering;
- huge jumps in point size;
- excessive indent levels;
- hyphenating headings;
- stranded headings separated from the following text.[^32]

Use bold rather than italic when a heading needs weight-based emphasis.

---

## 6. Font Selection & Pairing

### 6.1 A font is structural, not decorative

A font contains more than letter shapes. It also embodies:

- spacing;
- kerning;
- weights;
- italics;
- figures;
- punctuation;
- OpenType substitutions and features.

Font quality therefore affects the entire typographic system.[^34]

### 6.2 Prefer complete families

For serious body-text work, useful core styles include:

- roman;
- italic;
- bold;
- bold italic;
- genuine small caps where the design requires them.

A family with a coherent range of styles creates hierarchy without requiring
multiple unrelated typefaces.[^34]

### 6.3 Serif vs. sans serif

Butterick strongly prefers **serif type for long printed body text**, while not
presenting this as an inviolable law.[^7]

For screen or interface work, either serif or sans serif can succeed if:

- rendering is strong;
- apparent size is appropriate;
- spacing is controlled;
- the family provides the required characters and weights.

### 6.4 System fonts

Butterick's position is intentionally skeptical.

His concerns are that system fonts may be:

- designed primarily for screens rather than print;
- overused;
- stylistically generic;
- inconsistent in quality.

If constrained to system fonts, choose intentionally rather than defaulting
automatically to Times New Roman or Arial.[^35]

Among commonly available families that Butterick rates more favorably are
examples such as Charter, Avenir, Century Schoolbook, Garamond, Gill Sans,
Hoefler Text, Iowan Old Style, Palatino, and others depending on platform
availability.[^35]

**Tool-agnostic lesson:** Defaults are compatibility choices, not necessarily
design choices.

### 6.5 Free/open fonts

Butterick is critical of the average quality of free-font libraries but
explicitly identifies several strong freely licensed families, including:

- **Source Serif**
- **Source Code**
- **Cooper Hewitt**
- **IBM Plex**
- **Charter**

His broader recommendation is to evaluate free fonts by craftsmanship rather
than assuming either that “free means bad” or that a large library guarantees
quality.[^36]

### 6.6 Font pairing

#### Rule 1: Pairing is optional

One excellent family can supply substantial hierarchy through:

- roman;
- weight;
- italic;
- caps;
- small caps;
- size;
- spacing.

Do not introduce another font merely because a design seems to need “pairing.”[^37]

#### Rule 2: Diminishing returns

Butterick's practical ceiling:

- one font → entirely sufficient;
- two fonts → usually manageable;
- three fonts → difficult;
- four or more → almost never justified.

Treat all slides in a presentation as one document for this purpose.[^37]

#### Rule 3: Contrast need not mean serif + sans serif

Two serif faces or two sans-serif faces can work if they are visibly distinct
and assigned clear roles.

Font contrast should be intentional, not formulaic.[^37]

#### Rule 4: Give each font a role

Example roles:

- body vs. headings;
- primary content vs. peripheral metadata;
- prose vs. numeric labels;
- central content vs. edge annotations.

Do not randomly alternate fonts for visual variety.[^37]

#### Rule 5: Avoid mixing fonts within a paragraph

Switching typefaces inside continuous prose usually produces visual noise.

Prefer font changes at structural boundaries.[^37]

#### Rule 6: Same-designer pairings are often reliable

Families created by the same designer frequently share compatible proportions
and aesthetic assumptions, making them useful candidates for pairing.[^37]

---

## 7. Paragraph & Page Layout

### 7.1 Choose one paragraph-separation system

A new paragraph needs one clear signal.

Choose either:

1. **first-line indent**, or
2. **space between paragraphs**.

**NEVER use both for ordinary sequential paragraphs.**[^38]

### 7.2 First-line indent

Recommended range:

**1–4 × current text size**

Thus, for 12-unit body text:

**12–48 units**

Butterick translates this in print to approximately **0.17–0.67 inches**.[^38]

#### Adjustment

- narrow columns → use lower end;
- wider measures → deeper indent can work.

The first paragraph after a heading or obvious section boundary may omit the
indent because its beginning is already visually apparent.

#### Anti-pattern

Never construct indents with repeated spaces or arbitrary tabs.[^38]

### 7.3 Space between paragraphs

Butterick recommends approximately:

**4–10 pt**

or, more generally:

**50–100% of body-text size.**[^39]

The gap should be:

- clearly visible;
- smaller than the amount that would make paragraphs look unrelated.

Prefer a semantic paragraph-spacing mechanism rather than inserting empty
paragraphs.

### 7.4 Page margins

Margins are partly a consequence of desired line length.

For 12-pt text on a conventional printed page, Butterick notes that left and
right margins around **1.5–2.0 inches** will often produce a comfortable
measure, but he explicitly cautions against treating this as an absolute rule.[^40]

#### Governing relationship

Smaller text usually requires a narrower text block or larger margins.

Larger text can tolerate a wider text block.

Therefore:

**Design margins from readable line length outward rather than choosing
arbitrary margins first.**

### 7.5 Centered text

Use centered text sparingly.

Appropriate:

- brief titles;
- short phrases;
- selected major headings;
- some stationery treatments.

Avoid:

- full paragraphs;
- multi-line prose blocks;
- ordinary body text.[^41]

#### Rationale

Centered paragraphs have two irregular edges, weakening both reading rhythm and
alignment with surrounding elements.

If a short centered block must wrap, control the line breaks intentionally so
the resulting shape looks deliberate.[^41]

### 7.6 Left alignment vs. justification

Justification can create a formal rectangular text block, but it does so by
altering spacing between words.

#### Hard law

**If text is justified, hyphenation is mandatory.**[^42]

Without hyphenation, justified text tends to develop distracting holes and
rivers of whitespace.

#### Butterick's preference

For ordinary word-processing and web environments with relatively basic
justification engines, he generally favors left-aligned text.

Professional layout systems with sophisticated justification algorithms can
justify text more successfully.[^42]

#### If distributing justification space

Prefer adjusting **word spaces**, not continually altering letterspacing from
line to line.[^42]

### 7.7 Hyphenation

#### Justified text

**Mandatory.**

#### Left-aligned text

Optional.

Hyphenation can smooth the ragged right edge, but Butterick does not claim that
it inherently improves legibility.[^43]

#### Short measures

As line length decreases, hyphenation becomes increasingly useful because fewer
natural word-space breakpoints remain.

#### Headings

Suppress hyphenation in headings whenever possible.[^43]

### 7.8 Widow & orphan control

#### Definitions

- A **widow** is the last line of a paragraph stranded by itself at the top of
  the next page or column.
- An **orphan** is the first line of a paragraph stranded by itself at the
  bottom of a page or column.[^44]

#### Butterick's actual rule

Butterick does **not** state an absolute “never leave fewer than two lines” law.
He labels widow/orphan control **“your call”** and says he uses it when widows
or orphans cause a visible problem, because automatic control can create
conspicuous blank space at page bottoms.[^44]

Therefore, for a universal reference:

- **Preferred outcome:** avoid visibly distracting isolated paragraph lines at
  page or column boundaries.
- **Common production rule of thumb:** many layout systems preserve at least two
  lines together, but **this minimum-two-lines rule is not stated by Butterick
  and must not be attributed to him**.
- **Priority:** do not fix one straggler by creating another.

#### Interaction with the rest of the page

Widow/orphan problems are not independent of the layout system:

- **Line length** changes where paragraphs wrap and therefore where page breaks
  occur.
- **Line spacing** changes vertical pagination and can create or eliminate a
  stranded line.
- **Page margins** change the amount of usable vertical and horizontal space.
- **First-line indents** do not directly cure a widow or orphan, but they affect
  paragraph texture and can make the beginning of a paragraph more visually
  legible.

#### Practical adjustments

When a widow or orphan is visibly harmful, prefer one of these outcomes:

1. edit the paragraph slightly so the line breaks change;
2. move a line or two across the page/column boundary;
3. make a very small global or local adjustment to leading or page geometry if
   the document can tolerate it;
4. move the whole paragraph when it is short enough that the resulting page gap
   is acceptable.

Butterick explicitly warns against curing isolated cases with arbitrary hard
line breaks or carriage returns.[^44]

---

## 8. Specialized Elements

### 8.1 Block quotations

Recommended treatment:

- modestly reduce point size;
- modestly reduce line spacing;
- indent approximately **0.5–1 inch** on the left in print;
- optionally indent the right side;
- relative equivalent: approximately **2–5 em**;
- do not surround the block with quotation marks.[^45]

Maintain adequate line length after indentation.

### Content principle

Do not use enormous block quotations merely to signal importance.

Long quoted blocks are often skipped. Integrate and edit quoted material so
readers understand why it matters.[^45]

### 8.2 Lists

Use structurally defined lists rather than manually typing bullet or number
characters.

#### Bullet treatment

- keep bullet size modest;
- the bullet should identify the list item without becoming the dominant object;
- a small or subtle bullet often works better than an oversized solid mark;
- simple geometric marks are generally more durable than pictorial symbols.[^46]

The bullet or index may use a different font or slightly smaller size than the
item text if the distinction is systematic.

Do not use an asterisk simply because it is readily available; its size and
vertical position make it a poor general-purpose bullet.[^46]

### 8.3 Tables

Tables should reveal structure through alignment and whitespace before relying
on borders.

#### Cell spacing

Butterick recommends increasing overly tight default cell padding cautiously,
starting near **0.03 inch** and adjusting in approximately **0.01-inch
increments**.[^47]

Padding need not be identical on all four sides.

#### Rules

- avoid heavy boxing around every cell;
- remove unnecessary gridlines;
- use white space and alignment first;
- add rules only where they clarify grouping.

#### Typography

A dense table can often use text slightly smaller than surrounding prose,
provided the table remains readable and the spacing is appropriately adjusted.[^47]

### 8.4 Rules and borders

Lines should separate or group information, not decorate empty areas.

Prefer:

- fewer rules;
- thinner rules;
- rules attached to meaningful structure.

Avoid:

- thick rectangular boxes around every element;
- borders used merely to compensate for weak spacing;
- decorative line clutter.[^48]

### 8.5 Columns

Columns are a practical way to preserve readable line length on wide pages.

For a conventional **8.5 × 11 inch** printed page:

- **2 columns:** reasonable;
- **3 columns:** reasonable;
- **4 columns:** too many for ordinary text.[^49]

On scrolling digital interfaces, avoid newspaper-style multi-column prose when
reading would require moving vertically and then returning upward to the next
column.[^49]

---

## 9. Numeric Tables & Data-Dense Displays

Butterick's central rule for grids of numbers is unusually important for tables,
dashboards, financial reports, and data visualizations:

> **Digits with the same semantic meaning should align vertically.**

Different numerical types require different alignment.[^50]

### 9.1 Quantities

For monetary amounts and comparable quantities:

- align digits by place value;
- align decimal portions;
- preserve currency/units consistently;
- use a leading zero for values between zero and one when clarity benefits.

Example conceptual structure:

`0.75`\
`12.40`\
`315.00`

not a visually drifting set of values.[^50]

### 9.2 Decimal quantities

Align on the decimal point when varying numbers of fractional digits reflect
real precision.

Do **not** append meaningless zeros merely to make numbers line up if those
zeros would falsely imply measurement precision.[^50]

### 9.3 Nominal numbers

Identifiers are not quantities.

Examples:

- phone numbers;
- ZIP/postal codes;
- invoice identifiers.

Align them according to their internal structure rather than treating them as
measurable magnitudes.

Butterick's examples include:

- ZIP codes → often left-aligned;
- phone numbers → often right-aligned;
- invoice numbers → right-aligned in his sample.[^50]

### 9.4 Tabular figures

For numeric grids, prefer **tabular figures** where available.

Tabular figures give each digit a common advance width, allowing vertical digit
alignment.[^19][^50]

Lining figures are often visually convenient in tables because they reinforce
horizontal and vertical consistency.

### 9.5 Reduce table decoration

In data-heavy displays:

- numerical logic comes first;
- align data correctly;
- then design headers;
- remove unnecessary color;
- remove unnecessary borders;
- maintain even line spacing.

Header alignment does not have to mimic the data alignment if a different
treatment reads better.[^50]

---

## 10. Grids & Spatial Systems

A grid is a guide to consistent positioning, sizing, and alignment—not an
automatic generator of good design.

Useful grid functions include:

- aligning text blocks;
- relating headings to body text;
- controlling recurring widths;
- regulating margins;
- establishing spacing increments;
- coordinating tables and figures.[^51]

### 10.1 Prefer simple grids

**Coarse grids encourage consistency.**

An excessively fine grid provides so many possible positions that it ceases to
impose meaningful structure.[^51]

### 10.2 Symmetry is optional

Grids need not be rigid or symmetric.

Visual balance can emerge from asymmetrical relationships.

### 10.3 Mathematical ratios are tools, not laws

Golden ratios, modular scales, and proportional systems can suggest useful
dimensions, but they do not guarantee good typography.

**The eye is the final judge.**[^51]

### 10.4 A grid can emerge after exploration

It is valid to design several elements visually first, observe recurring
relationships, and then codify those relationships into a grid.

The purpose of a grid is consistency, not ideological purity.[^51]

---

## 11. Layout Maxims

Butterick's page-layout chapter can be converted into nine universal design
laws.[^52]

### 11.1 Design body text first

The largest quantity of text has the largest influence on the overall page.

Do not build elaborate chrome and then squeeze the content into what remains.

### 11.2 Separate foreground from background

Decide which elements deserve attention.

Typically:

**Foreground**

- body text;
- core numbers;
- primary headings;
- essential graphics.

**Background**

- metadata;
- page numbers;
- minor labels;
- secondary navigation;
- decorative or contextual information.

The background must not visually overpower the foreground.

### 11.3 Use the smallest visible adjustment

Good typography often depends on small differences.

Before doubling a heading size, try a small increase.

Before greatly increasing paragraph spacing, try a modest increment.

Before adding a new color, try weight, space, or position.

### 11.4 Compare alternatives visually

When two treatments seem plausible, render both.

Typography cannot be resolved purely by verbal logic because perception is the
final test.

### 11.5 Be consistent

**Things that are functionally the same should look the same.**

**Things that look different should actually represent a meaningful
difference.**

Random inconsistency teaches the reader a false hierarchy.

### 11.6 Relate each new element to existing elements

Once one element exists, every later element should establish some relationship
with it through:

- alignment;
- spacing;
- scale;
- font;
- weight;
- position.

Avoid isolated design decisions.

### 11.7 Keep it simple

Three colors and five fonts are rarely evidence of sophistication.

Remove elements before adding new ones.

### 11.8 Learn by imitation

Study effective professional typography and identify its underlying
relationships:

- measure;
- margins;
- type size;
- spacing;
- hierarchy;
- color;
- alignment.

Reusing successful principles is more productive than inventing arbitrary
novelty.

### 11.9 Do not fear whitespace

Whitespace does not need to be filled.

**Design outward from the text rather than inward from the edges.**

If the content block works, unused space around it can be an asset.[^52]

---

## 12. Styles & Systematic Typography

Typography becomes more reliable when visual properties are attached to
**semantic roles** rather than formatted ad hoc.

Instead of defining a style conceptually as:

> 13-point bold serif

define it as:

> Section Heading

Then attach the appearance to that role.

This distinction makes the system easier to revise without changing its
semantics.[^53]

### Rules

Create a reusable style whenever two or more elements should look the same.

Useful semantic classes include:

- body;
- heading level 1;
- heading level 2;
- caption;
- annotation;
- block quotation;
- list item;
- table header;
- table value;
- source note;
- slide title;
- axis label;
- legend;
- callout.

Benefits:

- consistency;
- global adjustment;
- inheritance;
- easier experimentation;
- fewer accidental deviations.[^53]

---

## 13. Presentations

Butterick's presentation advice begins with a fundamental point: design for the
**audience's viewing environment**, not the author's laptop.[^54]

### 13.1 Dark-room presentations

For projection in a dark room:

- begin with a very dark or black background;
- minimize emitted light;
- consider a relatively light-weight typeface;
- avoid full-intensity white unless needed;
- Butterick suggests beginning around **50% gray** for text and increasing
  brightness until comfortably legible.[^54]

The exact contrast should ultimately be tested in conditions resembling the
venue.

### 13.2 Do not let the software resize typography to fit content

Disable automatic text shrinking where possible.

**Edit the content to fit the typography rather than continuously shrinking
typography to fit the content.**[^54]

### 13.3 Establish a stable base size

Choose a base size that, as a practical test, would allow roughly **12–15
lines** of text on the slide.

This does not mean a slide should contain 15 lines. It is a way of establishing
a comfortable base reading size.[^54]

Keep this size reasonably consistent across the presentation.

Avoid making a one-line slide enormous merely because space is available.

### 13.4 Large slide titles and leading

Butterick criticizes enormous default slide headings and recommends restrained
headline sizing.[^24][^54]

For a genuinely large multi-line slide title, a proportionally tighter line
spacing than body text can be visually effective. **Butterick does not publish a
fixed heading-leading percentage.** A test value around **110–120%** may be
useful as a working experiment, but it is an inference, not a sourced Butterick
range. Compare alternatives at projection distance and retain the version that
reads cleanly.

### 13.5 Avoid giant centered headlines as a default

A slide title only needs enough hierarchy to function as a title.

Use:

- alignment;
- position;
- weight;
- moderate size contrast;
- whitespace.

rather than automatically creating huge centered text.[^54]

### 13.6 Use restrained color

Prefer muted or pale accents over intense saturated colors, particularly in dark
viewing conditions.

If the room is normally lit, an off-white background or dark-gray text can
soften excessive black/white contrast.[^54]

### 13.7 Do not fill the slide simply because it is wide

Wide-screen aspect ratios are not naturally ideal text measures.

A presentation may use only part of the available width.

**Unused slide area is not a defect.**[^54]

### 13.8 Bullets are optional

If every item is already visually separated and short, bullet marks may add
nothing.

Bullets are useful when they clarify item boundaries, not because slides are
culturally expected to contain bullets.[^54]

---

## 14. Websites & Responsive Digital Layouts

### 14.1 Treat the web as typography

A website is primarily a typographic environment whenever most of its
information is written language.

Do not treat typography as a cosmetic layer added after interaction and layout
decisions.[^55]

### 14.2 Avoid inherited web habits

Butterick identifies several historically common but undesirable conventions:

- tiny body text;
- enormous headings;
- unquestioned reliance on a tiny set of default system fonts;
- edges crammed with navigation;
- large decorative color blocks.[^55]

Modern tools remove much of the technical justification for these habits.

### 14.3 Responsive line length is non-negotiable

Even when viewport width changes, maintain approximately:

**45–90 characters per line.**[^1][^56]

A responsive container that stretches indefinitely is not typographically
responsive if its text becomes unreadably wide.

A practical responsive hierarchy is therefore:

1. preserve readable line length;
2. adjust surrounding whitespace;
3. adjust columns/layout;
4. only then alter type size if necessary.

### 14.4 Avoid template cargo cults

A popular layout pattern is not automatically a good solution.

Evaluate each convention against the content's purpose.

Templates should solve implementation problems without outsourcing design
judgment.[^55]

---

## 15. Sample-Document Principles

### 15.1 Research papers and long reports

Butterick's revised research-paper example demonstrates these changes:

- larger margins;
- line length around **65 characters** in that particular example;
- somewhat smaller point size;
- reduced line spacing;
- professional font;
- one sentence space;
- hyphenation;
- elimination of underlining.[^57]

#### Generalized rule

Formal does not mean large, double-spaced, underlined, or typewriter-like.

Professional typography can simultaneously improve legibility **and** fit more
information onto the page.

### 15.2 Research memos

Butterick's redesigned memo uses approximately:

- **2-inch side margins**;
- **1.5-inch top and bottom margins**;
- approximately **65 characters per line**;
- smaller type;
- tighter but controlled leading;
- reduced first-line indents;
- headings aligned with the body;
- headings only **0.5 pt larger** than body text;
- space before and after headings.[^58]

#### Key lesson

A half-point difference plus whitespace can create sufficient hierarchy.

Do not equate hierarchy with large scale jumps.

### 15.3 Résumés

Design the resume for skimming.

Visual emphasis should favor:

- names;
- roles;
- achievements;
- dates;
- actual qualifications.

Do not let generic headings dominate the page.

Butterick also emphasizes that a PDF preserves typography more reliably than
sharing an editable source document where font substitution can occur.[^59]

#### Anti-patterns

- novelty paper;
- decorative textures;
- generic template styling;
- oversized section labels;
- visual tricks that overpower substantive information.

### 15.4 Business cards

**Shrink and simplify.**

Butterick rejects layouts that push information to all four corners merely
because the physical card has four corners.[^60]

Instead:

- eliminate nonessential information;
- keep text size controlled;
- use consistent typography;
- letterspace caps/small caps;
- build outward from the information;
- let whitespace remain.

Small text is acceptable because the reading distance is close and the quantity
of text is low.

Professionally printed cards commonly use text around **6–8 pt**.[^24]

### 15.5 Grids of numbers

Design from the data's numerical meaning.

Sequence:

1. identify whether each field is a quantity, percentage, ordinal, or nominal
   identifier;
2. determine its internal alignment logic;
3. vertically align equivalent digits;
4. use tabular figures where necessary;
5. remove decorative rules and colors;
6. only then style headings.[^50]

This principle transfers directly to:

- financial tables;
- dashboards;
- KPI cards;
- statistical reports;
- dataframes;
- chart annotations;
- axis labels.

### 15.6 Contracts and dense technical documents

Dense documents improve when structure is created by:

- spacing;
- alignment;
- consistent numbering;
- line-length control;
- restrained emphasis.

rather than:

- all caps;
- excessive bold;
- narrow margins;
- thick borders;
- uninterrupted walls of text.

Butterick's sample contract uses columns to shorten line length and spacing to
separate numbered provisions.[^61]

The deeper lesson is that a structurally complex document should not
automatically become visually complex.

---

## 16. Applying These Principles to Charts, Dashboards & Visualizations

The book does not prescribe plotting, dashboard, or data-library syntax, but its
typography principles transfer directly.

### 16.1 Establish a base text system

Choose one primary text family and define:

- body/annotation size;
- title size;
- subtitle size;
- axis-label size;
- tick-label size;
- source-note size;
- legend size.

Keep differences small and purposeful.

### 16.2 Create hierarchy with several weak signals instead of one extreme signal

Prefer combinations such as:

- slightly larger size;
- slightly greater weight;
- more surrounding space;
- stronger position;

rather than making the title several times larger than everything else.

This follows Butterick's “smallest visible increment” principle.[^52]

### 16.3 Data dominates decoration

Treat:

- plotted values;
- labels needed to interpret them;
- essential reference lines

as foreground.

Treat:

- grids;
- frames;
- legends;
- footnotes;
- secondary annotations

as background.

Background components should never visually compete with the data. This is a
direct application of Butterick's foreground/background maxim.[^52]

### 16.4 Use color sparingly

When color already encodes data categories, avoid introducing additional
decorative colors into:

- headings;
- borders;
- labels;
- table furniture.

Every extra visual role competes with the data encoding.

### 16.5 Align numbers semantically

Numeric labels in tables and dashboard cards should follow the same numerical
logic described for grids of numbers:

- decimal alignment for decimal quantities;
- consistent units;
- tabular figures where rows must align;
- no fake precision;
- identifiers treated as identifiers, not magnitudes.[^50]

---

## 17. Universal Anti-Patterns

Avoid the following unless a strong contextual reason overrides the default:

1. Defaulting to whatever font the software supplies.
2. Using Times New Roman or Arial merely because they are ubiquitous.
3. Long paragraphs in bold.
4. Bold italic.
5. Underlining for ordinary emphasis.
6. Entire paragraphs in all caps.
7. Caps or small caps without additional tracking.
8. Fake small caps.
9. Disabled kerning.
10. Giant headings merely because space is available.
11. Excessive hierarchy levels.
12. Centered body text.
13. Double spaces between sentences.
14. Repeated spaces for alignment.
15. Manual tabs/spaces as a substitute for structural layout.
16. First-line indents **plus** paragraph spacing.
17. Justification without hyphenation.
18. Extremely long lines on wide screens.
19. Narrow lines without appropriate hyphenation or layout changes.
20. Thick borders around every table cell.
21. Decorative colors competing with meaningful color encoding.
22. Too many fonts.
23. Multiple fonts mixed casually within one paragraph.
24. Filling every available part of the page, chart, or slide.
25. Rigid mathematical scales treated as proof of good typography.
26. Letting automatic text resizing shrink content arbitrarily.
27. Styling each item independently rather than through semantic styles.
28. Allowing visually identical treatment to represent different semantics.
29. Allowing semantically identical items to drift into inconsistent visual
    treatments.
30. Designing the container first and forcing the text to fit afterward.
31. Automatically superscripting ordinal suffixes with mechanically shrunken
    characters.
32. Using optical spacing as the default when the font already contains good
    metrics.
33. Hyphenating raw web or email addresses.
34. Treating optional OpenType features as automatically beneficial merely
    because they exist.
35. Treating widow/orphan control as a rigid law when the resulting blank space
    is more distracting than the straggler.

These anti-patterns synthesize Butterick's summary rules, formatting chapters,
layout maxims, and sample documents.[^8]

---

## 18. Compact Decision Framework

When designing any text-bearing artifact, evaluate it in this order.

### Phase A — Meaning

1. What information is most important?
2. What must readers notice first?
3. What can be secondary?
4. Will readers read sequentially or skim?

### Phase B — Body typography

1. Choose the font.
2. Choose apparent size.
3. Set line spacing.
4. Control line length.

For continuous text, begin near:

- print size: **10–12 pt**;
- digital size: **15–25 px equivalent**;
- line height: **120–145%**;
- line length: **45–90 characters**.[^8]

### Phase C — Paragraph structure

Choose:

- first-line indentation **or**
- paragraph spacing.

Never both as the default.

Use:

- indent ≈ **1–4 × font size**, or
- paragraph gap ≈ **50–100% of font size**.[^38][^39]

### Phase D — Hierarchy

Create distinction using, in approximate order:

1. whitespace;
2. position;
3. weight;
4. modest scale;
5. font change;
6. restrained color.

Do not use every mechanism simultaneously.

### Phase E — Details

Verify:

- curly quotation marks;
- correct apostrophes;
- true dashes;
- ellipsis character;
- one sentence space;
- correct accents;
- real small caps;
- caps tracking;
- kerning;
- nonbreaking spaces where units must remain together;
- correct figure style for prose vs. data;
- ordinals not mechanically shrunk;
- OpenType features supported by both font and renderer;
- URLs and email addresses free of misleading hyphenation.

### Phase F — Alignment

Check:

- recurring left edges;
- heading/body relationships;
- list hanging indents;
- table columns;
- numeric place values;
- chart labels;
- captions;
- metadata.

### Phase G — Pagination

Check:

- visible widows and orphans;
- headings stranded from the text they introduce;
- short paragraphs pushed intact in ways that create excessive page-bottom gaps;
- whether a small edit solves the break more elegantly than a layout override.

### Phase H — Reduction

Ask:

- Can a font be removed?
- Can a color be removed?
- Can a border be removed?
- Can a heading level be removed?
- Can a label be shortened?
- Can whitespace replace decoration?

### Phase I — Test in context

Evaluate the artifact at its actual:

- physical size;
- screen size;
- viewing distance;
- lighting;
- output medium.

Do not judge a projected slide only on a laptop or a printed report only at 200%
zoom. This follows Butterick's reader-centered approach, particularly his
presentation guidance.[^3][^54]

---

## 19. Hard Rules vs. Judgment Calls

### Strong / near-hard defaults

- Use one space after sentences.
- Use curly quotation marks for quotations.
- Distinguish hyphens from dashes.
- Use the actual ellipsis character.
- Do not use repeated spaces for layout.
- Do not combine paragraph indentation and paragraph spacing.
- Enable kerning.
- Use real small caps or none.
- Add 5–12% tracking to caps and small caps.
- Use hyphenation with justified text.
- Avoid long blocks of all caps.
- Avoid underlining except where it serves a special semantic role such as
  links.
- Keep equivalent numerical positions vertically aligned.
- Use semantic styles for recurring elements.
- Do not automatically hyphenate raw web or email addresses.
- Prefer metrics spacing when a well-designed font already supplies spacing and
  kerning.
- Do not use mechanically shrunken ordinal superscripts.[^8][^20][^21][^22]

### Strong ranges, but context-sensitive

- body size;
- line height;
- line length;
- margins;
- paragraph indents;
- paragraph spacing;
- block-quote indentation;
- table padding.

These should be treated as robust starting ranges, then optically adjusted.

### Primarily judgment calls

- serif vs. sans serif;
- one font vs. two;
- left aligned vs. justified;
- exact heading size;
- precise color;
- symmetric vs. asymmetric layout;
- mathematical grid ratios;
- whether to hyphenate left-aligned prose;
- whether major headings should be centered;
- exact margin geometry;
- whether widow/orphan control improves a particular pagination;
- whether optional ligatures or alternate glyphs improve a particular font;
- how tightly to lead genuinely large display type.

Butterick's broader philosophy is that typography should solve the communication
problem rather than satisfy an abstract recipe.[^5]

---

## 20. LLM Instruction Summary

When using this document as context for an LLM generating typography rules for
another environment, instruct the model to preserve these priorities:

1. **Optimize for the reader.**
2. **Establish body typography before secondary styling.**
3. **Use approximately 45–90 characters per line for continuous prose.**
4. **Use approximately 120–145% line height for body text.**
5. **Use modest rather than dramatic hierarchy changes.**
6. **Use whitespace as a primary structural tool.**
7. **Keep the number of fonts low—usually one or two.**
8. **Use caps only for short text and add 5–12% tracking.**
9. **Use genuine small caps only.**
10. **Keep kerning enabled.**
11. **Use one paragraph-separation mechanism: indent or spacing.**
12. **Use justification only with hyphenation.**
13. **Avoid centered continuous text.**
14. **Make data alignment reflect numerical meaning.**
15. **Prefer alignment and whitespace over boxes and decoration.**
16. **Distinguish foreground information from background furniture.**
17. **Use the smallest perceptible adjustment that achieves the goal.**
18. **Do not fill available space merely because it exists.**
19. **Treat mathematical scales and grids as aids, not authorities.**
20. **Render alternatives and trust visual comparison.**
21. **Use semantic styles to enforce consistency.**
22. **Design for the final viewing environment.**
23. **Preserve typographically correct punctuation and characters.**
24. **Reduce unnecessary fonts, colors, rules, labels, and hierarchy before
    adding more.**
25. **Judge success by whether the typography reinforces meaning.**

Additional v2 operational checks:

- Treat large-display leading below the body-text range as an **optical
  inference**, not a Butterick numeric law.
- Treat widow/orphan control as **situational**, not a mandatory
  minimum-two-lines rule.
- Use alternate figures, ligatures, true small caps, and other OpenType features
  only when the font and renderer support them and the feature serves the
  content.
- Do not mechanically superscript ordinals.
- Do not hyphenate web or email addresses.
- Prefer metrics spacing to algorithmic optical spacing when the font's own
  spacing is sound.

---

## 21. One-Page Universal Specification

For an ordinary text-heavy artifact with no stronger domain-specific
constraints, begin with:

| Variable               | Starting specification                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Primary typeface       | One high-quality, readable family                                                                                                     |
| Secondary typeface     | None unless it has a defined role                                                                                                     |
| Body size              | 10–12 pt print / 15–25 px-equivalent screen                                                                                           |
| Line height            | 1.20–1.45 × body size                                                                                                                 |
| Display line height    | No universal Butterick ratio; test proportionally tighter leading by eye. A 1.10–1.20 experiment is an inference, not a sourced rule. |
| Small-text line height | Reduce absolute spacing with size; keep sufficient separation. No separate universal Butterick percentage.                            |
| Line length            | 45–90 characters including spaces                                                                                                     |
| Paragraph treatment    | indent OR paragraph gap                                                                                                               |
| First-line indent      | 1–4 × body size                                                                                                                       |
| Paragraph gap          | 0.5–1.0 × body size                                                                                                                   |
| Widow/orphan control   | Prevent visibly distracting isolated lines when useful; Butterick treats automatic control as discretionary                           |
| Main heading           | modest size/weight difference + whitespace                                                                                            |
| Heading levels         | 2 preferred, 3 maximum                                                                                                                |
| Caps                   | less than one line                                                                                                                    |
| Caps tracking          | +5–12%                                                                                                                                |
| Small caps             | genuine glyphs only; +5–12% tracking                                                                                                  |
| Kerning                | enabled                                                                                                                               |
| Emphasis               | bold OR italic, sparingly                                                                                                             |
| Underlining            | avoid except semantically appropriate links                                                                                           |
| Alignment              | left aligned by default                                                                                                               |
| Justification          | only with hyphenation                                                                                                                 |
| Centering              | short phrases/titles only                                                                                                             |
| Body color, print      | black                                                                                                                                 |
| Body color, screen     | black or comfortable near-black/dark gray                                                                                             |
| Borders                | minimal                                                                                                                               |
| Grid                   | simple, coarse, flexible                                                                                                              |
| Numeric figures        | tabular where vertical alignment matters                                                                                              |
| Raw URLs/email         | no automatic hyphenation                                                                                                              |
| Ordinals               | no mechanically shrunken superscripts                                                                                                 |
| OpenType               | use only supported, purposeful features                                                                                               |
| Font spacing mode      | prefer designer metrics; optical only as an emergency correction                                                                      |
| Whitespace             | preserve; never treat empty area as a defect                                                                                          |

The body-text numbers above consolidate the book's main quantitative
recommendations; the display-leading example is explicitly an inference rather
than a Butterick-authored range.[^8][^24][^25]

---

## 22. Governing Principle

The master rule behind all of the preceding guidance is:

**Typography should make the meaning, hierarchy, and structure of information
easier for the reader to perceive while consuming as little unnecessary
attention as possible.**

Typography is not successful because it is conspicuous, fashionable,
mathematically elegant, or visually elaborate. It is successful when the visual
presentation strengthens the work the text is trying to do.[^4]

---

## References

[^1]: Matthew Butterick, “Line length,” _Practical Typography_:
    https://practicaltypography.com/line-length.html

[^2]: Matthew Butterick, “What is typography?”, _Practical Typography_:
    https://practicaltypography.com/what-is-typography.html

[^3]: Matthew Butterick, “Who is typography for?”, _Practical Typography_:
    https://practicaltypography.com/who-is-typography-for.html

[^4]: Matthew Butterick, “Why does typography matter?”, _Practical Typography_:
    https://practicaltypography.com/why-does-typography-matter.html

[^5]: Matthew Butterick, “What is good typography?”, _Practical Typography_:
    https://practicaltypography.com/what-is-good-typography.html

[^6]: Matthew Butterick, “Where do the rules come from?”, _Practical
    Typography_:
    https://practicaltypography.com/where-do-the-rules-come-from.html

[^7]: Matthew Butterick, “Body text,” _Practical Typography_:
    https://practicaltypography.com/body-text.html

[^8]: Matthew Butterick, “Summary of key rules,” _Practical Typography_:
    https://practicaltypography.com/summary-of-key-rules.html

[^9]: Matthew Butterick, “One space between sentences,” _Practical Typography_:
    https://practicaltypography.com/one-space-between-sentences.html

[^10]: Matthew Butterick, “Hyphens and dashes,” _Practical Typography_:
    https://practicaltypography.com/hyphens-and-dashes.html

[^11]: Matthew Butterick, “Ellipses,” _Practical Typography_:
    https://practicaltypography.com/ellipses.html

[^12]: Matthew Butterick, “Apostrophes,” _Practical Typography_:
    https://practicaltypography.com/apostrophes.html

[^13]: Matthew Butterick, “Foot and inch marks,” _Practical Typography_:
    https://practicaltypography.com/foot-and-inch-marks.html

[^14]: Matthew Butterick, “White-space characters,” _Practical Typography_:
    https://practicaltypography.com/white-space-characters.html

[^15]: Matthew Butterick, “Tabs and tab stops,” _Practical Typography_:
    https://practicaltypography.com/tabs-and-tab-stops.html

[^16]: Matthew Butterick, “OpenType features,” _Practical Typography_:
    https://practicaltypography.com/opentype-features.html

[^17]: Matthew Butterick, “Ligatures,” _Practical Typography_:
    https://practicaltypography.com/ligatures.html

[^18]: Matthew Butterick, “Small caps,” _Practical Typography_:
    https://practicaltypography.com/small-caps.html

[^19]: Matthew Butterick, “Alternate figures,” _Practical Typography_:
    https://practicaltypography.com/alternate-figures.html

[^20]: Matthew Butterick, “Ordinals,” _Practical Typography_:
    https://practicaltypography.com/ordinals.html

[^21]: Matthew Butterick, “Metrics vs. optical spacing,” _Practical Typography_:
    https://practicaltypography.com/metrics-vs-optical-spacing.html

[^22]: Matthew Butterick, “Web & email addresses,” _Practical Typography_:
    https://practicaltypography.com/web-and-email-addresses.html

[^23]: Matthew Butterick, “Emoticons & emoji,” _Practical Typography_:
    https://practicaltypography.com/emoticons-and-emoji.html

[^24]: Matthew Butterick, “Point size,” _Practical Typography_:
    https://practicaltypography.com/point-size.html

[^25]: Matthew Butterick, “Line spacing,” _Practical Typography_:
    https://practicaltypography.com/line-spacing.html

[^26]: Matthew Butterick, “Bold or italic,” _Practical Typography_:
    https://practicaltypography.com/bold-or-italic.html

[^27]: Matthew Butterick, “Underlining,” _Practical Typography_:
    https://practicaltypography.com/underlining.html

[^28]: Matthew Butterick, “All caps,” _Practical Typography_:
    https://practicaltypography.com/all-caps.html

[^29]: Matthew Butterick, “Letterspacing,” _Practical Typography_:
    https://practicaltypography.com/letterspacing.html

[^30]: Matthew Butterick, “Kerning,” _Practical Typography_:
    https://practicaltypography.com/kerning.html

[^31]: Matthew Butterick, “Color,” _Practical Typography_:
    https://practicaltypography.com/color.html

[^32]: Matthew Butterick, “Headings,” _Practical Typography_:
    https://practicaltypography.com/headings.html

[^33]: Matthew Butterick, “Space above & below,” _Practical Typography_:
    https://practicaltypography.com/space-above-and-below.html

[^34]: Matthew Butterick, “Font basics,” _Practical Typography_:
    https://practicaltypography.com/font-basics.html

[^35]: Matthew Butterick, “System fonts,” _Practical Typography_:
    https://practicaltypography.com/system-fonts.html

[^36]: Matthew Butterick, “Free fonts,” _Practical Typography_:
    https://practicaltypography.com/free-fonts.html

[^37]: Matthew Butterick, “Mixing fonts,” _Practical Typography_:
    https://practicaltypography.com/mixing-fonts.html

[^38]: Matthew Butterick, “First-line indents,” _Practical Typography_:
    https://practicaltypography.com/first-line-indents.html

[^39]: Matthew Butterick, “Space between paragraphs,” _Practical Typography_:
    https://practicaltypography.com/space-between-paragraphs.html

[^40]: Matthew Butterick, “Page margins,” _Practical Typography_:
    https://practicaltypography.com/page-margins.html

[^41]: Matthew Butterick, “Centered text,” _Practical Typography_:
    https://practicaltypography.com/centered-text.html

[^42]: Matthew Butterick, “Justified text,” _Practical Typography_:
    https://practicaltypography.com/justified-text.html

[^43]: Matthew Butterick, “Hyphenation,” _Practical Typography_:
    https://practicaltypography.com/hyphenation.html

[^44]: Matthew Butterick, “Widow and orphan control,” _Practical Typography_:
    https://practicaltypography.com/widow-and-orphan-control.html

[^45]: Matthew Butterick, “Block quotations,” _Practical Typography_:
    https://practicaltypography.com/block-quotations.html

[^46]: Matthew Butterick, “Bulleted and numbered lists,” _Practical Typography_:
    https://practicaltypography.com/bulleted-and-numbered-lists.html

[^47]: Matthew Butterick, “Tables,” _Practical Typography_:
    https://practicaltypography.com/tables.html

[^48]: Matthew Butterick, “Rules & borders,” _Practical Typography_:
    https://practicaltypography.com/rules-and-borders.html

[^49]: Matthew Butterick, “Columns,” _Practical Typography_:
    https://practicaltypography.com/columns.html

[^50]: Matthew Butterick, “Grids of numbers,” _Practical Typography_:
    https://practicaltypography.com/grids-of-numbers.html

[^51]: Matthew Butterick, “Grids,” _Practical Typography_:
    https://practicaltypography.com/grids.html

[^52]: Matthew Butterick, “Maxims of page layout,” _Practical Typography_:
    https://practicaltypography.com/maxims-of-page-layout.html

[^53]: Matthew Butterick, “Paragraph and character styles,” _Practical
    Typography_:
    https://practicaltypography.com/paragraph-and-character-styles.html

[^54]: Matthew Butterick, “Presentations,” _Practical Typography_:
    https://practicaltypography.com/presentations.html

[^55]: Matthew Butterick, “Websites,” _Practical Typography_:
    https://practicaltypography.com/websites.html

[^56]: Matthew Butterick, “Responsive web design,” _Practical Typography_:
    https://practicaltypography.com/responsive-web-design.html

[^57]: Matthew Butterick, “Research papers,” _Practical Typography_:
    https://practicaltypography.com/research-papers.html

[^58]: Matthew Butterick, “Research memos,” _Practical Typography_:
    https://practicaltypography.com/research-memos.html

[^59]: Matthew Butterick, “Résumés,” _Practical Typography_:
    https://practicaltypography.com/resumes.html

[^60]: Matthew Butterick, “Business cards,” _Practical Typography_:
    https://practicaltypography.com/business-cards.html

[^61]: Matthew Butterick, “Contracts,” _Practical Typography_:
    https://practicaltypography.com/contracts.html

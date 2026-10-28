// Marginal footnotes, after hugo-tania's footnotes.ts. On wide screens each
// footnote is copied into the notes column beside its reference and pushed
// down when it would overlap the note above. The Goldmark footnote list stays
// in the HTML and is only hidden while sidenotes show, so it remains the
// fallback without JS and on narrow screens. References keep their hrefs.
// Margin callouts (.callout-margin, see _markup/render-blockquote.html) share
// the same stacking: they stay in the article DOM and are only offset into the
// notes column, beside the block that follows them.
(() => {
  const layout = document.querySelector(".article-layout");
  const column = layout && layout.querySelector(".sidenotes");
  const body = layout && layout.querySelector(".article-body");
  if (!column || !body) return;
  const list = body.querySelector(".footnotes");
  const callouts = [...body.querySelectorAll(".callout-margin")];
  if (!list && !callouts.length) return;

  const GAP = 12; // px between stacked notes

  const notes = [];
  for (const item of list ? list.querySelectorAll("li[id]") : []) {
    const ref = body.querySelector(`a.footnote-ref[href="#${CSS.escape(item.id)}"]`);
    if (!ref) continue;
    const note = document.createElement("div");
    note.className = "sidenote";
    note.setAttribute("role", "note");
    note.tabIndex = -1;
    note.innerHTML = item.innerHTML;
    note.querySelectorAll(".footnote-backref").forEach((a) => a.remove());
    const number = document.createElement("span");
    number.className = "sidenote-number";
    number.textContent = ref.textContent;
    (note.firstElementChild || note).prepend(number, " ");
    notes.push({ ref, note });
  }

  // A margin callout stays in the column when it is long or holds blocks.
  const MAX_LINES = 8;
  const dev = layout.hasAttribute("data-dev");
  const warned = new Set();
  const refuse = (el, why) => {
    if (dev && !warned.has(el)) {
      warned.add(el);
      console.warn(`margin callout kept in the column (${why}):`, el);
    }
    return false;
  };
  const fits = (el) => {
    if (el.querySelector("pre, ul, ol, table, img, .footnote-ref")) return refuse(el, "code, list or other block");
    el.classList.add("is-margin");
    const text = el.querySelector(".callout-body");
    const lines = text.offsetHeight / parseFloat(getComputedStyle(text).lineHeight);
    return lines <= MAX_LINES || refuse(el, `about ${Math.round(lines)} lines`);
  };

  // Read every height first, then write every position: one layout pass.
  // Footnotes and margin callouts stack together in order of their anchors
  // (a footnote's reference; the block after a callout), so neither overlaps
  // the other and nothing sits above its anchor.
  const place = () => {
    const origin = column.getBoundingClientRect().top;
    const bodyTop = body.getBoundingClientRect().top - origin;
    const items = [
      ...notes.map(({ ref, note }) => ({ el: note, y: ref.getBoundingClientRect().top - origin })),
      ...callouts
        .filter((el) => el.classList.contains("is-margin"))
        .map((el) => {
          // skip sibling margin callouts: they are positioned, so they make poor anchors
          let next = el.nextElementSibling;
          while (next && next.classList.contains("is-margin")) next = next.nextElementSibling;
          let prev = el.previousElementSibling;
          while (prev && prev.classList.contains("is-margin")) prev = prev.previousElementSibling;
          const y = next ? next.getBoundingClientRect().top : prev ? prev.getBoundingClientRect().bottom : el.getBoundingClientRect().top;
          return { el, y: y - origin, offset: bodyTop };
        }),
    ];
    items.forEach((item) => (item.h = item.el.offsetHeight));
    items.sort((a, b) => a.y - b.y); // stable: ties keep document order
    let floor = 0;
    for (const { el, y, h, offset } of items) {
      const top = Math.max(y, floor);
      el.style.top = `${offset === undefined ? top : top - offset}px`;
      floor = top + h + GAP;
    }
    // A tall last note may run past the article; grow the column instead of overlapping the foot.
    column.style.minHeight = `${floor}px`;
  };

  // The breakpoint lives in CSS only; it sets --wide: 1 on the layout.
  let active = false;
  const sync = () => {
    const wide = getComputedStyle(layout).getPropertyValue("--wide").trim() === "1";
    if (wide !== active) {
      active = wide;
      layout.classList.toggle("has-sidenotes", wide);
      column.replaceChildren(...(wide ? notes.map(({ note }) => note) : []));
      if (!wide) {
        column.style.minHeight = "";
        for (const el of callouts) {
          el.classList.remove("is-margin");
          el.style.top = "";
        }
      }
    }
    if (active) {
      for (const el of callouts) if (!fits(el)) el.classList.remove("is-margin");
      place();
    }
  };

  for (const { ref, note } of notes) {
    const link = (on) => () => {
      ref.classList.toggle("is-linked", on);
      note.classList.toggle("is-linked", on);
    };
    for (const el of [ref, note]) {
      el.addEventListener("mouseenter", link(true));
      el.addEventListener("mouseleave", link(false));
    }
    // The list target is hidden while sidenotes show; point at the sidenote instead.
    ref.addEventListener("click", (event) => {
      if (!active) return;
      event.preventDefault();
      note.focus({ preventScroll: true });
    });
  }

  new ResizeObserver(sync).observe(body);
  window.addEventListener("resize", sync);
  document.fonts.ready.then(sync);
  sync();
})();

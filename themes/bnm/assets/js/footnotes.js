// Marginal footnotes, after hugo-tania's footnotes.ts. On wide screens each
// footnote is copied into the notes column beside its reference and pushed
// down when it would overlap the note above. The Goldmark footnote list stays
// in the HTML and is only hidden while sidenotes show, so it remains the
// fallback without JS and on narrow screens. References keep their hrefs.
(() => {
  const layout = document.querySelector(".article-layout");
  const column = layout && layout.querySelector(".sidenotes");
  const body = layout && layout.querySelector(".article-body");
  const list = body && body.querySelector(".footnotes");
  if (!column || !list) return;

  const GAP = 12; // px between stacked notes

  const notes = [];
  for (const item of list.querySelectorAll("li[id]")) {
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

  // Read every height first, then write every position: one layout pass.
  const place = () => {
    const origin = column.getBoundingClientRect().top;
    const wanted = notes.map(({ ref }) => ref.getBoundingClientRect().top - origin);
    const heights = notes.map(({ note }) => note.offsetHeight);
    let floor = 0;
    notes.forEach(({ note }, i) => {
      const top = Math.max(wanted[i], floor);
      note.style.top = `${top}px`;
      floor = top + heights[i] + GAP;
    });
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
      if (!wide) column.style.minHeight = "";
    }
    if (active) place();
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

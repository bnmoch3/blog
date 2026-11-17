// Table of contents: opened beside the article on wide screens, collapsed above
// it otherwise, and marks the heading being read. Active-heading detection
// follows tania_rascia's useActiveHash (IntersectionObserver, rootMargin
// "0% 0% -80% 0%"), but recomputes from all headings so scrolling up works too.
(() => {
  const layout = document.querySelector(".article-layout");
  const toc = layout && layout.querySelector(".toc");
  if (!toc) return;

  const details = toc.querySelector("details");
  const pairs = [...toc.querySelectorAll('a[href^="#"]')]
    .map((link) => [link, document.getElementById(decodeURIComponent(link.hash.slice(1)))])
    .filter(([, heading]) => heading);

  // Reserve each entry's semibold size (see .toc-bold in article.css).
  for (const [link] of pairs) {
    const text = document.createElement("span");
    text.className = "toc-text";
    text.append(...link.childNodes);
    const bold = text.cloneNode(true);
    bold.className = "toc-bold";
    bold.setAttribute("aria-hidden", "true");
    link.append(text, bold);
  }

  // The breakpoint lives in CSS only; it sets --wide: 1 on the layout.
  const isWide = () => getComputedStyle(layout).getPropertyValue("--wide").trim() === "1";

  let wasWide = null;
  const syncOpen = () => {
    const wide = isWide();
    if (wide !== wasWide) {
      details.open = wide;
      wasWide = wide;
      syncSections();
    }
  };

  // Sections: h2 entries with h3/h4 children. On wide screens only the section
  // holding the current entry is open; the others are collapsed by CSS
  // (.is-tree, article.css) and made inert so their links leave the tab order
  // and the accessibility tree. A section whose children hold focus stays
  // open, so scrolling with the keyboard never drops focus to body. Narrow
  // screens and no-JS show the whole tree.
  const nav = toc.querySelector("nav");
  const sections = [...nav.querySelectorAll(":scope > ul > li")]
    .map((li) => [li, li.querySelector(":scope > ul")])
    .filter(([, list]) => list);
  nav.classList.add("is-tree");

  let current = null;
  const syncSections = () => {
    const wide = isWide();
    for (const [li, list] of sections) {
      const open = !wide || li.contains(current) || list.contains(document.activeElement);
      li.classList.toggle("is-open", open);
      list.inert = !open;
    }
  };

  // Keep the current link visible inside a scrolling sidebar without moving the page.
  const reveal = () => {
    if (!current || details.scrollHeight <= details.clientHeight) return;
    const l = current.getBoundingClientRect();
    const d = details.getBoundingClientRect();
    if (l.top < d.top || l.bottom > d.bottom) {
      details.scrollTop += l.top - d.top - d.height / 3;
    }
  };

  // A clicked link stays active until the reader's next input, even when the
  // next heading also lands above the line (very short sections).
  let pinned = null;
  const setActive = () => {
    const line = window.innerHeight * 0.2;
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    let active = pinned;
    for (const [link, heading] of pinned ? [] : pairs) {
      if (atBottom || heading.getBoundingClientRect().top <= line) active = link;
      else break;
    }
    if (active === current) return;
    if (current) current.removeAttribute("aria-current");
    current = active;
    if (active) active.setAttribute("aria-current", "location");
    syncSections();
    reveal();
  };

  syncOpen(); // also syncs the sections
  window.addEventListener("resize", syncOpen);
  document.addEventListener("focusin", syncSections);
  // Sections change height over a short transition; re-check once it ends.
  nav.addEventListener("transitionend", (event) => {
    if (event.propertyName === "grid-template-rows") reveal();
  });

  // Sidebar title: shown once the h1 is above the viewport (CSS hides it when narrow).
  const title = toc.querySelector(".toc-title");
  const h1 = document.querySelector(".single-title");
  if (title && h1) {
    new IntersectionObserver(([entry]) => {
      title.classList.toggle("is-shown", !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }).observe(h1);
  }

  const observer = new IntersectionObserver(setActive, { rootMargin: "0% 0% -80% 0%" });
  pairs.forEach(([, heading]) => observer.observe(heading));
  toc.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link && pairs.some(([l]) => l === link)) {
      pinned = link;
      setActive();
    }
  });
  for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) {
    window.addEventListener(type, () => (pinned = null), { passive: true });
  }
  window.addEventListener("scrollend", setActive);
  setActive();
})();

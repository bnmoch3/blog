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

  // The breakpoint lives in CSS only; it sets --wide: 1 on the layout.
  const isWide = () => getComputedStyle(layout).getPropertyValue("--wide").trim() === "1";

  let wasWide = null;
  const syncOpen = () => {
    const wide = isWide();
    if (wide !== wasWide) {
      details.open = wide;
      wasWide = wide;
    }
  };

  // A clicked link stays active until the reader's next input, even when the
  // next heading also lands above the line (very short sections).
  let current = null;
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
    if (!active) return;
    active.setAttribute("aria-current", "location");

    // Keep the active link visible inside a scrolling sidebar without moving the page.
    if (details.scrollHeight > details.clientHeight) {
      const l = active.getBoundingClientRect();
      const d = details.getBoundingClientRect();
      if (l.top < d.top || l.bottom > d.bottom) {
        details.scrollTop += l.top - d.top - d.height / 3;
      }
    }
  };

  syncOpen();
  window.addEventListener("resize", syncOpen);

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

// Code blocks: a copy button in each block's .code-tools (added here so it
// never shows without JS or clipboard access).
(() => {
  if (!navigator.clipboard) return;
  for (const figure of document.querySelectorAll("figure.code")) {
    const tools = figure.querySelector(".code-tools");
    const code = figure.querySelector(".lntd:last-child pre code") || figure.querySelector("pre code");
    if (!tools || !code) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.textContent = "copy";
    button.setAttribute("aria-label", "Copy code");
    button.setAttribute("aria-live", "polite");

    let timer;
    button.addEventListener("click", async () => {
      let label = "copied";
      try {
        await navigator.clipboard.writeText(code.textContent.replace(/\n$/, ""));
      } catch {
        label = "copy failed";
      }
      button.textContent = label;
      button.setAttribute("aria-label", label);
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.textContent = "copy";
        button.setAttribute("aria-label", "Copy code");
      }, 1600);
    });
    tools.prepend(button);
  }
})();

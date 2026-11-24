/* Markdown Lens — renders plain-text Markdown pages as HTML. */
(() => {
  "use strict";

  // Only act on pages the browser shows as plain text (not on real HTML pages
  // that happen to end in .md, e.g. a GitHub blob view).
  const type = (document.contentType || "").toLowerCase();
  const isText = /^text\/(plain|markdown|x-markdown)/.test(type);
  if (!isText || document.documentElement.dataset.mdvRendered) return;

  const pre = document.querySelector("body > pre");
  const source = pre ? pre.textContent : document.body.innerText;
  if (source == null) return;
  document.documentElement.dataset.mdvRendered = "1";

  // ---- Front matter (YAML/TOML, as used by Hugo/Jekyll) -------------------
  let body = source;
  let frontMatter = null;
  const fm = body.match(/^(---|\+\+\+)\r?\n([\s\S]*?)\r?\n\1[ \t]*(\r?\n|$)/);
  if (fm) {
    frontMatter = fm[2];
    body = body.slice(fm[0].length);
  }
  const fmTitle = frontMatter && frontMatter.match(/^title\s*[:=]\s*["']?(.+?)["']?\s*$/m);

  // ---- Math: $inline$, $`inline`$ (GitHub), $$display$$ --------------------
  // The parser only emits placeholders holding the TeX source; KaTeX renders
  // them after sanitizing, so its output never passes through DOMPurify.
  const escapeHtml = (s) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const mathHtml = (tex, display) =>
    display
      ? `<div class="mdv-math" data-display="1">${escapeHtml(tex)}</div>\n`
      : `<span class="mdv-math">${escapeHtml(tex)}</span>`;
  const mathExtension = {
    extensions: [
      {
        name: "mathBlock",
        level: "block",
        start: (src) => src.match(/^ {0,3}\$\$/m)?.index,
        tokenizer(src) {
          const m = src.match(/^ {0,3}\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/);
          if (m) return { type: "mathBlock", raw: m[0], text: m[1].trim() };
        },
        renderer: (t) => mathHtml(t.text, true),
      },
      {
        name: "mathInline",
        level: "inline",
        start: (src) => src.indexOf("$"),
        tokenizer(src) {
          const m =
            src.match(/^\$`([^`]+)`\$/) ||
            src.match(/^\$\$((?:\\.|[^\\$])+?)\$\$/) ||
            src.match(/^\$(?![\s$])((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/);
          if (m) return { type: "mathInline", raw: m[0], text: m[1], display: m[0].startsWith("$$") };
        },
        renderer: (t) => mathHtml(t.text, t.display),
      },
    ],
  };

  // ---- Render --------------------------------------------------------------
  marked.setOptions({ gfm: true, breaks: false });
  marked.use(mathExtension);
  if (typeof markedFootnote === "function") marked.use(markedFootnote());
  const html = DOMPurify.sanitize(marked.parse(body), {
    ADD_ATTR: ["target"],
  });

  const el = (tag, props = {}, children = []) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    for (const c of [].concat(children)) n.append(c);
    return n;
  };

  const article = el("article", { className: "mdv-body" });
  if (frontMatter !== null) {
    const details = el("details", { className: "mdv-frontmatter" }, [
      el("summary", { textContent: "Front matter" }),
      el("pre", { textContent: frontMatter }),
    ]);
    article.append(details);
  }
  const content = el("div");
  content.innerHTML = html;
  article.append(...content.childNodes);

  // ---- Heading anchors + table of contents --------------------------------
  const used = new Map();
  const slug = (text) => {
    let s = text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const n = used.get(s) || 0;
    used.set(s, n + 1);
    return n ? `${s}-${n}` : s;
  };

  const tocList = el("ul");
  for (const h of article.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const id = h.id || slug(h.textContent);
    h.id = id;
    h.prepend(el("a", { className: "mdv-anchor", href: `#${id}`, textContent: "#", ariaHidden: "true" }));
    const level = Number(h.tagName[1]);
    if (level <= 4 && !h.classList.contains("sr-only")) {
      const text = h.textContent.replace(/^#/, "");
      tocList.append(
        el("li", { className: `mdv-toc-l${level}` }, el("a", { href: `#${id}`, textContent: text }))
      );
    }
  }

  // ---- GitHub alerts: > [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
  const ALERTS = { note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution" };
  for (const bq of article.querySelectorAll("blockquote")) {
    const p = bq.firstElementChild;
    const first = p && p.tagName === "P" ? p.firstChild : null;
    const m = first && first.nodeType === Node.TEXT_NODE && first.data.match(/^\s*\[!(\w+)\][ \t]*\n?/);
    const kind = m && m[1].toLowerCase();
    if (!kind || !ALERTS[kind]) continue;
    first.data = first.data.slice(m[0].length);
    if (p.firstChild && p.firstChild.nodeName === "BR") p.firstChild.remove();
    if (!p.textContent.trim() && !p.querySelector("img")) p.remove();
    bq.classList.add("mdv-alert", `mdv-alert-${kind}`);
    bq.prepend(el("p", { className: "mdv-alert-title", textContent: ALERTS[kind] }));
  }

  // ---- Code: diagrams, math, syntax highlighting + copy button ------------
  // Fenced blocks with these languages become diagrams instead of code.
  const DIAGRAMS = { mermaid: "mermaid", flow: "flowchart", flowchart: "flowchart", sequence: "sequence" };
  const diagrams = [];
  for (const code of article.querySelectorAll("pre > code")) {
    const lang = ((code.className.match(/language-([\w+-]+)/) || [])[1] || "").toLowerCase();
    const pre = code.parentElement;
    if (DIAGRAMS[lang]) {
      const box = el("div", { className: `mdv-diagram mdv-${DIAGRAMS[lang]}` });
      diagrams.push({ kind: DIAGRAMS[lang], box, src: code.textContent });
      pre.replaceWith(box);
      continue;
    }
    if (lang === "math" || lang === "latex" || lang === "katex") {
      const box = el("div", { className: "mdv-math", textContent: code.textContent });
      box.dataset.display = "1";
      pre.replaceWith(box);
      continue;
    }
    // PlantUML needs Java, which a browser cannot run offline: keep the
    // source, labelled, without guessing a highlighting language.
    const noHighlight = lang === "plantuml" || lang === "puml";
    if (noHighlight) {
      pre.classList.add("mdv-plantuml");
      pre.dataset.label = "PlantUML";
    }
    try {
      if (noHighlight) {
        /* plain source */
      } else if (lang && hljs.getLanguage(lang)) {
        code.innerHTML = hljs.highlight(code.textContent, { language: lang }).value;
      } else {
        code.innerHTML = hljs.highlightAuto(code.textContent).value;
      }
      code.classList.add("hljs");
    } catch (_) {
      /* leave unhighlighted */
    }
    const btn = el("button", { className: "mdv-copy", type: "button", textContent: "Copy" });
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = "Copied";
      } catch (_) {
        btn.textContent = "Failed";
      }
      setTimeout(() => (btn.textContent = "Copy"), 1200);
    });
    code.parentElement.classList.add("mdv-pre");
    code.parentElement.append(btn);
  }

  // External links open in a new tab; local links (other .md files) stay put.
  for (const a of article.querySelectorAll("a[href]")) {
    if (/^https?:/i.test(a.getAttribute("href"))) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  }

  // ---- Page shell ----------------------------------------------------------
  const raw = el("pre", { className: "mdv-raw", textContent: source, hidden: true });
  const toc = el("nav", { className: "mdv-toc" }, [el("div", { className: "mdv-toc-title", textContent: "Contents" }), tocList]);
  const hasToc = tocList.children.length > 1;

  const btnToc = el("button", { type: "button", textContent: "Contents", title: "Toggle table of contents (t)" });
  const btnRaw = el("button", { type: "button", textContent: "Raw", title: "Toggle raw Markdown (r)" });
  const btnTheme = el("button", { type: "button", className: "mdv-theme" });
  const toolbar = el("div", { className: "mdv-toolbar" }, [...(hasToc ? [btnToc] : []), btnRaw, btnTheme]);

  const main = el("main", { className: "mdv-main" }, [article, raw]);
  document.body.replaceChildren(toolbar, ...(hasToc ? [toc] : []), main);
  document.body.className = "mdv";

  const head = document.head || document.documentElement.insertBefore(el("head"), document.body);
  head.append(el("meta", { name: "color-scheme", content: "light dark" }));
  head.append(el("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }));

  const fileName = decodeURIComponent(location.pathname.split("/").pop() || "");
  const firstH1 = article.querySelector("h1");
  document.title =
    (fmTitle && fmTitle[1]) || (firstH1 && firstH1.textContent.replace(/^#/, "").trim()) || fileName;

  // TOC visibility is remembered per browser; default: shown on wide screens.
  const store = (k, v) => {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (_) {
      return null;
    }
  };
  const tocPref = store("mdv-toc");
  if (hasToc && (tocPref === "1" || (tocPref === null && innerWidth >= 1100))) {
    document.body.classList.add("mdv-toc-open");
  }

  const toggleToc = () => {
    if (!hasToc) return;
    const open = document.body.classList.toggle("mdv-toc-open");
    store("mdv-toc", open ? "1" : "0");
  };
  const toggleRaw = () => {
    raw.hidden = !raw.hidden;
    article.hidden = !raw.hidden;
    btnRaw.textContent = raw.hidden ? "Raw" : "Rendered";
  };
  // Theme: auto (follow the system) -> light -> dark -> auto. Remembered per browser.
  const THEMES = ["auto", "light", "dark"];
  const THEME_LABEL = { auto: "◐ Auto", light: "☀ Light", dark: "☾ Dark" };
  const applyTheme = (theme) => {
    if (theme === "auto") delete document.documentElement.dataset.mdvTheme;
    else document.documentElement.dataset.mdvTheme = theme;
    btnTheme.textContent = THEME_LABEL[theme];
    btnTheme.title = `Theme: ${theme} — click to change (d)`;
  };
  let theme = THEMES.includes(store("mdv-theme")) ? store("mdv-theme") : "auto";
  applyTheme(theme);

  // ---- Math (KaTeX) ---------------------------------------------------------
  const mathEls = article.querySelectorAll(".mdv-math");
  if (mathEls.length) {
    // Loaded as a <link> so the stylesheet's relative font URLs resolve
    // inside the extension.
    head.append(el("link", { rel: "stylesheet", href: chrome.runtime.getURL("vendor/katex/katex.min.css") }));
    for (const m of mathEls) {
      const tex = m.textContent;
      try {
        katex.render(tex, m, { displayMode: m.dataset.display === "1", throwOnError: false });
      } catch (err) {
        m.textContent = tex;
        m.classList.add("mdv-error");
        m.title = String(err.message || err);
      }
    }
  }

  // ---- Diagrams -------------------------------------------------------------
  const isDark = () =>
    theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const showError = (d, err) => {
    d.box.replaceChildren(
      el("div", { className: "mdv-diagram-error", textContent: `${d.kind} diagram error: ${err.message || err}` }),
      el("pre", { textContent: d.src })
    );
  };
  // flowchart.js and js-sequence-diagrams draw with Raphael; they need the
  // element in the document to measure text, so run after the page shell.
  for (const d of diagrams) {
    if (d.kind === "mermaid") continue;
    try {
      if (d.kind === "flowchart") flowchart.parse(d.src).drawSVG(d.box);
      else Diagram.parse(d.src).drawSVG(d.box, { theme: "simple" });
    } catch (err) {
      showError(d, err);
    }
  }
  // Mermaid is large (~5 MB), so it is only loaded when a page uses it.
  const mermaidDiagrams = diagrams.filter((d) => d.kind === "mermaid");
  let mermaidLib = null;
  let mermaidRun = 0;
  const renderMermaid = async () => {
    if (!mermaidDiagrams.length) return;
    const run = ++mermaidRun;
    try {
      mermaidLib ||= (await import(chrome.runtime.getURL("vendor/mermaid/mermaid.esm.min.mjs"))).default;
    } catch (err) {
      for (const d of mermaidDiagrams) showError(d, err);
      return;
    }
    mermaidLib.initialize({ startOnLoad: false, securityLevel: "strict", theme: isDark() ? "dark" : "default" });
    for (const [i, d] of mermaidDiagrams.entries()) {
      if (run !== mermaidRun) return; // the theme changed again; a newer run takes over
      try {
        const { svg } = await mermaidLib.render(`mdv-mermaid-${run}-${i}`, d.src);
        d.box.innerHTML = svg;
      } catch (err) {
        showError(d, err);
      }
    }
  };
  renderMermaid();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (theme === "auto") renderMermaid();
  });

  const cycleTheme = () => {
    const wasDark = isDark();
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    store("mdv-theme", theme);
    applyTheme(theme);
    if (isDark() !== wasDark) renderMermaid();
  };

  btnToc.addEventListener("click", toggleToc);
  btnRaw.addEventListener("click", toggleRaw);
  btnTheme.addEventListener("click", cycleTheme);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "t") toggleToc();
    if (e.key === "r") toggleRaw();
    if (e.key === "d") cycleTheme();
  });

  // Jump to #fragment now that heading ids exist.
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
  }
})();

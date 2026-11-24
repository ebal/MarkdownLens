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
  // Form controls are dropped (like GitHub does): a document must not be able
  // to show a fake login form. Task-list checkboxes are the only <input>s kept.
  const PURIFY = {
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["form", "button", "select", "textarea"],
    FORBID_ATTR: ["formaction"],
  };
  const html = DOMPurify.sanitize(marked.parse(body), PURIFY);

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
  for (const input of content.querySelectorAll('input:not([type="checkbox"])')) input.remove();
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

  // A malformed %-escape in the URL must not stop the rest of the rendering.
  const decode = (s) => {
    try {
      return decodeURIComponent(s);
    } catch (_) {
      return s;
    }
  };
  const fileName = decode(location.pathname.split("/").pop() || "");
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
  // Diagram libraries build their SVG after the Markdown was sanitized, and
  // flowchart.js turns `text:>javascript:…` into a clickable link and
  // `text:$name` into a click handler. Every diagram goes through DOMPurify
  // before it is shown; re-parsing the markup also drops those handlers.
  // Mermaid draws its labels as HTML inside <foreignObject>; DOMPurify only
  // keeps that HTML (still sanitized) when foreignObject is an integration point.
  const sanitizeSvg = (markup) =>
    DOMPurify.sanitize(markup, {
      ...PURIFY,
      ADD_TAGS: ["foreignObject"],
      HTML_INTEGRATION_POINTS: { foreignobject: true },
    });
  // flowchart.js and js-sequence-diagrams draw with Raphael; they need the
  // element in the document to measure text, so run after the page shell.
  for (const d of diagrams) {
    if (d.kind === "mermaid") continue;
    try {
      if (d.kind === "flowchart") flowchart.parse(d.src).drawSVG(d.box);
      else Diagram.parse(d.src).drawSVG(d.box, { theme: "simple" });
      d.box.innerHTML = sanitizeSvg(d.box.innerHTML);
    } catch (err) {
      showError(d, err);
    }
  }
  // Mermaid is large (~5 MB), so it is only loaded when a page uses it. It runs
  // in a hidden extension page (mermaid.html) instead of this content script:
  // Firefox runs content scripts in a sandbox where `self.Object !== Object`,
  // and lodash inside mermaid then fails ("call to Function() blocked by CSP",
  // "Math.max is not a function"). The frame is an ordinary page in both
  // browsers; it receives the diagram source and posts back the SVG.
  const mermaidDiagrams = diagrams.filter((d) => d.kind === "mermaid");
  const frameUrl = chrome.runtime.getURL("mermaid.html");
  const frameOrigin = new URL(frameUrl).origin;
  const pending = new Map();
  let frame = null;
  let frameReady = null;
  let requestId = 0;
  const mermaidFrame = () =>
    (frameReady ||= new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("the mermaid renderer did not load")), 20000);
      addEventListener("message", (e) => {
        if (!frame || e.source !== frame.contentWindow || e.origin !== frameOrigin || !e.data) return;
        const { ready, id, svg, error } = e.data;
        if (ready) {
          clearTimeout(timer);
          resolve();
          return;
        }
        const req = pending.get(id);
        if (!req) return;
        pending.delete(id);
        if (error) req.reject(new Error(error));
        else req.resolve(svg);
      });
      // Off screen but not display:none, so mermaid can measure text.
      frame = el("iframe", { src: frameUrl, title: "mermaid renderer", tabIndex: -1 });
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText =
        "position:absolute;left:-10000px;top:0;width:1200px;height:900px;border:0;visibility:hidden";
      document.body.append(frame);
    }));
  const renderInFrame = async (src, dark) => {
    await mermaidFrame();
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      frame.contentWindow.postMessage({ id, src, dark }, frameOrigin);
    });
  };

  let mermaidRun = 0;
  const renderMermaid = async () => {
    if (!mermaidDiagrams.length) return;
    const run = ++mermaidRun;
    const dark = isDark();
    for (const d of mermaidDiagrams) {
      if (run !== mermaidRun) return; // the theme changed again; a newer run takes over
      try {
        const svg = await renderInFrame(d.src, dark);
        if (run === mermaidRun) d.box.innerHTML = sanitizeSvg(svg);
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
    const target = document.getElementById(decode(location.hash.slice(1)));
    if (target) target.scrollIntoView();
  }
})();

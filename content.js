/* Markdown Viewer (offline) — renders plain-text Markdown pages as HTML. */
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

  // ---- Render --------------------------------------------------------------
  marked.setOptions({ gfm: true, breaks: false });
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
    if (level <= 4) {
      const text = h.textContent.replace(/^#/, "");
      tocList.append(
        el("li", { className: `mdv-toc-l${level}` }, el("a", { href: `#${id}`, textContent: text }))
      );
    }
  }

  // ---- Code: syntax highlighting + copy button ----------------------------
  for (const code of article.querySelectorAll("pre > code")) {
    const lang = (code.className.match(/language-([\w+-]+)/) || [])[1];
    try {
      if (lang && hljs.getLanguage(lang)) {
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
  const toolbar = el("div", { className: "mdv-toolbar" }, hasToc ? [btnToc, btnRaw] : [btnRaw]);

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
  btnToc.addEventListener("click", toggleToc);
  btnRaw.addEventListener("click", toggleRaw);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "t") toggleToc();
    if (e.key === "r") toggleRaw();
  });

  // Jump to #fragment now that heading ids exist.
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
  }
})();

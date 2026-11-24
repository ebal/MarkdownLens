/* Markdown Lens — renders mermaid diagrams for content.js.
   Runs in mermaid.html, an extension page that content.js embeds as a hidden
   iframe. It receives {id, src, dark} from the parent page and answers with
   {id, svg} or {id, error}. */
import mermaid from "./vendor/mermaid/mermaid.esm.min.mjs";

let queue = Promise.resolve();
let theme = null;

addEventListener("message", (e) => {
  if (e.source !== parent || !e.data || typeof e.data.src !== "string") return;
  const { id, src, dark } = e.data;
  // mermaid keeps global state, so render one diagram at a time.
  queue = queue.then(async () => {
    const wanted = dark ? "dark" : "default";
    if (theme !== wanted) {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: wanted, suppressErrorRendering: true });
      theme = wanted;
    }
    try {
      const { svg } = await mermaid.render(`mdv-mermaid-${id}`, src);
      parent.postMessage({ id, svg }, "*");
    } catch (err) {
      parent.postMessage({ id, error: String((err && err.message) || err) }, "*");
    }
  });
});

parent.postMessage({ ready: true }, "*");

# Markdown Viewer (offline)

Markdown Viewer is a Chromium extension (Brave, Chrome, Chromium, Edge) that
renders Markdown files as HTML when you open them in the browser, for example
`file:///home/you/Desktop/self-hosted-home-alarm-with-home-assistant.md`.
Everything runs locally: the Markdown parser, the HTML sanitizer and the syntax
highlighter ship inside the extension, so it needs no network access and works
offline.

### Features

- GitHub Flavored Markdown: tables, task lists, strikethrough, autolinks, fenced code.
- Syntax highlighting for code blocks, with a **Copy** button on each block.
- Light and dark theme: follows your system setting by default, or pick one with the theme button (`d`).
- Table of contents sidebar built from the headings (`t` toggles it).
- Raw Markdown view (`r` toggles between rendered and raw).
- Heading anchors, so `file.md#some-heading` links work.
- YAML/TOML front matter (Hugo, Jekyll) is hidden in a collapsible block, and its `title` becomes the tab title.
- Relative links and images work, because the page keeps the file's own URL.
- Raw HTML inside the Markdown is sanitized with [DOMPurify](https://github.com/cure53/DOMPurify) before display.

## Installation

### Requirements

- A Chromium-based browser with Manifest V3 support (Brave, Chrome, Chromium, Edge).

### Load the unpacked extension

1. Open `brave://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this directory (the one with `manifest.json`).
4. Click **Details** on the *Markdown Viewer (offline)* card and turn on
   **Allow access to file URLs**. Without this, the extension cannot run on `file://` pages.

## Usage

Open any Markdown file in the browser:

```text
file:///home/you/Desktop/self-hosted-home-alarm-with-home-assistant.md
```

Instead of plain text you get a rendered page. Use the buttons in the top right
corner, or the keyboard:

| Key | Action |
| --- | --- |
| `t` | Show or hide the table of contents |
| `r` | Switch between rendered HTML and raw Markdown |
| `d` | Cycle the theme: Auto (system) → Light → Dark |

The theme you pick is remembered for all Markdown files you open.

The extension handles these extensions: `.md`, `.MD`, `.markdown`, `.mdown`,
`.mkd`, `.mkdn` on `file://`, and `.md` / `.markdown` on `http(s)://` when the
server sends them as plain text (for example raw files from a Git host). Pages
that are already HTML are left alone.

To see a file change, reload the tab (`F5`).

## Project layout

```text
manifest.json        extension manifest (the version lives here)
content.js           detects plain-text Markdown and renders it
content.css          page styling, light and dark
vendor/              bundled third-party libraries (offline)
icons/               extension icons (icon.svg is the source)
```

### Bundled libraries

| Library | Version | License |
| --- | --- | --- |
| [marked](https://github.com/markedjs/marked) | 15.0.12 | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.2.6 | Apache-2.0 / MPL-2.0 |
| [highlight.js](https://github.com/highlightjs/highlight.js) | 11.11.1 | BSD-3-Clause |

To update a library, replace the file in `vendor/` and reload the extension on
the extensions page.

## Contributing

Pull requests are welcome. After you change a file, click the reload icon on the
extension card in `brave://extensions`, then reload the Markdown tab.

## License

[MIT](https://choosealicense.com/licenses/mit/)

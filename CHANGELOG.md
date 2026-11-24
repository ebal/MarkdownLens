# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.5] - 2026-11-24

### Added

- Releases are submitted to addons.mozilla.org (listed), where Mozilla reviews and signs them, so Firefox users can install and update Markdown Lens from there.
- Declare in the manifest that the extension collects no data (`data_collection_permissions`), as addons.mozilla.org requires for new add-ons.
- MIT `LICENSE` file.

### Changed

- Firefox and LibreWolf 140 or newer are required (was 128), the first versions that understand the data collection declaration.

## [0.2.4] - 2026-11-24

### Added

- README: a Privacy section on what the extension can access and what remote content (images, media, CSS `url()`) a document can load.

### Changed

- The theme and table-of-contents settings are kept in the extension's own storage instead of each website's `localStorage`, so they now apply on every site. Settings saved by older versions are moved over once and removed from the site. This adds the `storage` permission, which browsers grant without asking.

## [0.2.3] - 2026-11-24

### Added

- Demo video of Markdown Lens in action at the top of the README.
- README: a Download section for the release `.zip` (Chromium) and `.xpi` (Firefox, LibreWolf) packages.
- README: install steps for Firefox and LibreWolf, including the site access permission and opening local `file://` Markdown files.
- The GitHub release workflow can be run by hand for an existing tag; running it again replaces the attached packages.

### Changed

- README uses this repository's `tests/manual-test.md` as the example file.
- The manual test page also checks that flowchart links and form controls are neutralized.

### Fixed

- A malformed `%` escape in the file name or `#anchor` no longer stops the rendering halfway.

### Removed

- Tags and release pages for 0.1.0, 0.2.0 and 0.2.1; 0.2.2 is the earliest release you can download.

### Security

- Fix script injection through flowchart.js diagrams: a node written as `text:>javascript:…` became a link that ran code in the page when clicked. All diagram output (flowchart.js, sequence diagrams, mermaid) is now sanitized with DOMPurify, which also removes flowchart.js `text:$function` click handlers.
- Update DOMPurify from 3.2.6 to 3.5.0, which fixes published sanitizer bypasses (GHSA-v8jm-5vwx-cfxm, GHSA-v2wj-7wpq-c8vv, GHSA-h8r8-wccr-v5f2).
- Remove form controls (`<form>`, `<button>`, `<select>`, `<textarea>`, and every `<input>` except task-list checkboxes) from rendered Markdown, so a document cannot show a working fake login form.
- Accept mermaid results only from the extension's own renderer frame (checks the message origin as well as its source).

## [0.2.2] - 2026-11-24

### Added

- Manual test page `tests/manual-test.md` that exercises every feature.

### Fixed

- Mermaid diagrams failing in Firefox and LibreWolf with "Syntax error in text" or "call to Function() blocked by CSP"; mermaid now renders in a hidden extension page.
- Leftover mermaid error graphics at the bottom of the page after a diagram with a syntax error.

## [0.2.1] - 2026-11-24

### Added

- Each tagged release on Gitea and GitHub now has a `.zip` (Chromium) and an `.xpi` (Firefox) package attached, built automatically.

## [0.2.0] - 2026-11-24

### Added

- Theme toggle button (and `d` key) to switch between Auto, Light and Dark; the choice is remembered.
- Firefox add-on ID in the manifest, so the extension can be loaded and signed in Firefox (experimental).
- KaTeX math: `$inline$`, `` $`inline`$ ``, `$$display$$` and ` ```math ` blocks.
- Mermaid diagrams, loaded only on pages that use them and following the light/dark theme.
- flowchart.js (` ```flow `) and js-sequence-diagrams (` ```sequence `) diagrams.
- GitHub Flavored Markdown footnotes and alerts (`> [!NOTE]` and friends).
- Label ` ```plantuml ` blocks as PlantUML source; they are not rendered, so nothing leaves your machine.

### Changed

- Rename the extension from Markdown Viewer (offline) to Markdown Lens.

## [0.1.0] - 2026-11-24

### Added

- Render plain-text Markdown files (`file://` and `http(s)://`) as HTML, fully offline.
- GitHub Flavored Markdown with sanitized HTML output.
- Syntax highlighting and a copy button for code blocks.
- Automatic light and dark theme.
- Table of contents sidebar and raw Markdown view, with `t` and `r` shortcuts.
- Heading anchors and front matter handling.

[unreleased]: https://github.com/ebal/MarkdownLens/compare/v0.2.5...HEAD
[0.2.5]: https://github.com/ebal/MarkdownLens/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/ebal/MarkdownLens/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/ebal/MarkdownLens/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/ebal/MarkdownLens/releases/tag/v0.2.2
[0.2.1]: https://github.com/ebal/MarkdownLens/commit/9da120f
[0.2.0]: https://github.com/ebal/MarkdownLens/commit/6d87df5
[0.1.0]: https://github.com/ebal/MarkdownLens/commit/d87f2dd

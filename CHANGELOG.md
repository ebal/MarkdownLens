# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/ebal/MarkdownLens/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/ebal/MarkdownLens/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/ebal/MarkdownLens/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ebal/MarkdownLens/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ebal/MarkdownLens/releases/tag/v0.1.0

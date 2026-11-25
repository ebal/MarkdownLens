#!/bin/bash
# Packages the extension into dist/: a .zip for Chromium browsers and an
# identical .xpi for Firefox. manifest.json sits at the top of both archives.
# Used by the GitHub and Gitea release workflows, and works locally too.
set -euo pipefail

readonly E_XCD=3

cd "$(dirname "$0")/.." || exit "$E_XCD"

name="markdown-lens"
version=$(node -p 'require("./manifest.json").version')
files=(manifest.json content.js content.css mermaid.html mermaid-frame.js icons vendor)
# The logo is the source of the icons and is shown in the README; the
# extension itself only uses the icon*.png files.
exclude=(icons/MarkdownLens.png)

mkdir -p dist
rm -f "dist/${name}-${version}.zip" "dist/${name}-${version}.xpi"
zip -qr "dist/${name}-${version}.zip" "${files[@]}" -x "${exclude[@]}"
cp "dist/${name}-${version}.zip" "dist/${name}-${version}.xpi"

echo "Built dist/${name}-${version}.zip and dist/${name}-${version}.xpi"

#!/usr/bin/env bash
# Trim Source Sans 3 (variable, 200-900) to what the app shows (ADR 0006; DESIGN.md "Typography"):
# Latin, and the Latin Extended letters of IAST and ISO 15919 a rasika may type. Writes the two
# woff2 files app/src/styles/app.css loads. Needs fonttools with brotli (pip install fonttools
# brotli) and the @fontsource-variable/source-sans-3 dev dependency (npm ci).
#
# Usage: tools/fonts/subset.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
src="$root/node_modules/@fontsource-variable/source-sans-3/files"
out="$root/app/src/styles/fonts"

# Keep these ranges in step with the unicode-range of each @font-face in app/src/styles/app.css.
latin='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
ext='U+0100-017F,U+0300-036F,U+1E0C-1E0D,U+1E24-1E25,U+1E36-1E3B,U+1E40-1E49,U+1E5A-1E5F,U+1E62-1E63,U+1E6C-1E6D,U+1E8E-1E8F'

pyftsubset "$src/source-sans-3-latin-wght-normal.woff2" --unicodes="$latin" \
  --layout-features='*' --flavor=woff2 --output-file="$out/source-sans-3-latin.woff2"
pyftsubset "$src/source-sans-3-latin-ext-wght-normal.woff2" --unicodes="$ext" \
  --layout-features='*' --flavor=woff2 --output-file="$out/source-sans-3-ext.woff2"
cp "$src/../LICENSE" "$out/OFL.txt"
ls -l "$out"

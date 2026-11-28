#!/usr/bin/env bash
# Keeps search engines off staging (docs/setup/staging.md), and only staging.
#
#   tools/deploy/noindex.sh add <dist>     add `X-Robots-Tag: noindex, nofollow` on every path to
#                                          <dist>/_headers; deploy.sh does this to the staging build
#   tools/deploy/noindex.sh check <dist>   exit 0 if <dist>/_headers sends noindex, 1 if not
#
# deploy.sh adds it after the checks, to the build it is about to upload, so app/public/_headers
# (and so production) never carries it. A production deploy stops if its build sends noindex.
set -euo pipefail

usage() {
  echo "usage: tools/deploy/noindex.sh add|check <dist>" >&2
  exit 2
}
[[ $# -eq 2 ]] || usage
action="$1"
headers="$2/_headers"
[[ -d "$2" ]] || {
  echo "noindex: no directory at $2." >&2
  exit 2
}

# Any rule sending noindex counts for check, wherever it sits.
sends_noindex() { [[ -f "$headers" ]] && grep -qiE '^[[:space:]]+X-Robots-Tag:.*noindex' "$headers"; }

case "$action" in
  add)
    sends_noindex && exit 0
    {
      [[ ! -s "$headers" ]] || printf '\n'
      printf '# Staging only (tools/deploy/noindex.sh): no search engine may index or follow it.\n'
      printf '/*\n  X-Robots-Tag: noindex, nofollow\n'
    } >>"$headers"
    ;;
  check) sends_noindex ;;
  *) usage ;;
esac

#!/usr/bin/env bash
# Look for a secret in a build before it ships (T111). deploy.sh runs it on app/dist.
#
# Usage: tools/deploy/dist-secrets.sh <dir>
# Exits 0 when the build holds none. Exits 1 and prints what kind and in which file when it holds
# one, never the value. Exits 2 when <dir> isn't a directory.
#
# It matches a real key, not the bare prefix: supabase-js itself holds the text
# `startsWith('sb_secret_')`, so the prefix alone is in every build. Supabase documents no length
# for its keys (`sb_secret_…`, about 30 key characters in its examples), and Google's client
# secrets are `GOCSPX-` and 28 more, so 20 or more key characters after the prefix is a key.
set -euo pipefail

dir="${1:-}"
[[ -d "$dir" ]] || {
  echo "Usage: $0 <dir>" >&2
  exit 2
}

kinds=(
  "a Supabase secret key (sb_secret_…)"
  "Google's client secret (GOCSPX-…)"
)
patterns=(
  'sb_secret_[A-Za-z0-9_-]{20,}'
  'GOCSPX-[A-Za-z0-9_-]{20,}'
)

found=false
for i in "${!patterns[@]}"; do
  status=0
  files="$(grep -rlaE -- "${patterns[$i]}" "$dir")" || status=$?
  ((status <= 1)) || exit 2
  if [[ -n "$files" ]]; then
    echo "${kinds[$i]} in ${files//$'\n'/, }"
    found=true
  fi
done
[[ "$found" == false ]]

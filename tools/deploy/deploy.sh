#!/usr/bin/env bash
# Build the app with the real catalog snapshot, run the full-catalog checks, and deploy it to
# Cloudflare only if they all pass (ADR 0008; CONTRIBUTING.md "Deploying"). Runs on the
# Maintainer's machine, which holds the snapshot. Holds no token or account id: wrangler uses
# the Maintainer's own sign-in (`npx wrangler login`, or CLOUDFLARE_API_TOKEN in their shell).
#
# Usage, from the repository root:
#   tools/deploy/deploy.sh <snapshot.json> [--dry-run] [--without-golden-set]
#
#   --dry-run             everything but the upload: build, check, then `wrangler deploy --dry-run`
#   --without-golden-set  deploy although the golden set (T027) fails; said again at the end
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

# The public-data project (ADR 0009): the logger's Supabase project, which holds the catalog and
# serves the Schedule from its `schedule` function. Not a secret: the deployed bundle shows it.
# Only the deployed build gets it; the checks below, the e2e and the hill-climb rig build
# without it, so they never reach the real project.
public_data_url="https://zddeaewyohognvbbazdl.supabase.co"

stop() {
  echo >&2
  echo "deploy: stopped. $1" >&2
  echo "deploy: nothing was deployed." >&2
  exit 1
}
step() { printf '\n== %s\n' "$1"; }

[[ "$public_data_url" =~ ^https://[a-z0-9]+\.supabase\.co$ ]] ||
  stop "public_data_url in tools/deploy/deploy.sh is not a Supabase project's https address (ADR 0009). Without it the phone never fetches the Schedule."

snapshot=""
dry_run=false
without_golden=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    --without-golden-set) without_golden=true ;;
    -*) stop "unknown option $arg." ;;
    *)
      [[ -z "$snapshot" ]] || stop "give one snapshot, not several."
      snapshot="$arg"
      ;;
  esac
done
[[ -n "$snapshot" ]] ||
  stop "give the snapshot to deploy, e.g. /opt/carnatic/logger/pipeline/karnatik/catalog-snapshots/catalog.<hash>.json"
[[ -f "$snapshot" ]] || stop "no snapshot at $snapshot."
file="$(basename "$snapshot")"
[[ "$file" =~ ^catalog\.[0-9a-f]{64}\.json$ ]] ||
  stop "$file is not named catalog.<sha256>.json, as the logger exports it."
version="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version ?? "")' "$snapshot")" ||
  stop "$file is not valid JSON."
[[ -n "$version" ]] || stop "$file has no version."

commit="$(git rev-parse --short HEAD)"
echo "Snapshot: $file"
echo "Version:  $version"
echo "Commit:   $commit"
echo "Schedule: $public_data_url/functions/v1/schedule/"
[[ -z "$(git status --porcelain)" ]] || echo "Note: the working tree has uncommitted changes; they deploy too."

step "Copying the snapshot into app/public/catalog/"
rm -rf app/public/catalog
mkdir -p app/public/catalog
cp "$snapshot" "app/public/catalog/$file"

step "Building, with the size budget (snapshot in)"
npm run build -w app || stop "the build or the size budget failed."

step "Search accuracy: the golden set (SC-010)"
golden_json="$(mktemp)"
trap 'rm -f "$golden_json"' EXIT
golden_ok=true
npx vitest run --project tools tools/golden-set/golden.test.ts \
  --reporter=default --reporter=json --outputFile.json="$golden_json" || golden_ok=false
skipped="$(node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log(r.numPendingTests + r.numTodoTests);
' "$golden_json" 2>/dev/null)" || stop "the golden set did not run."
[[ "$skipped" == "0" ]] ||
  stop "the golden set skipped $skipped test(s), so it never saw the snapshot."
if [[ "$golden_ok" == false ]]; then
  [[ "$without_golden" == true ]] ||
    stop "the golden set failed. Until T027 is reviewed, deploy with --without-golden-set."
  echo "The golden set failed; going on because of --without-golden-set."
fi

step "All checks: types, lint, tests, end-to-end, size (npm run check)"
if [[ "$golden_ok" == true ]]; then
  npm run check || stop "npm run check failed."
else
  # npm run check's steps, less the golden set, which already failed above.
  { npm run typecheck && npm run lint && npx vitest run --exclude 'tools/golden-set/**' &&
    npm run e2e && npm run size; } || stop "npm run check failed."
fi

# The checks' end-to-end tests build app/dist again, with no public-data URL. So the build to
# upload is made last, with it, and checked for it.
step "Building for deploy, with the Schedule's public-data project"
VITE_PUBLIC_DATA_URL="$public_data_url" npm run build -w app || stop "the build or the size budget failed."
[[ -f "app/dist/catalog/$file" ]] || stop "the build in app/dist does not hold $file."
grep -rqF "$public_data_url" app/dist/assets ||
  stop "the build in app/dist does not hold $public_data_url, so no phone would fetch the Schedule."

step "Files to upload (app/dist)"
(cd app/dist && find . -type f ! -name _headers ! -name .assetsignore ! -name precache-phases.json |
  sort | while read -r path; do printf '%10s  %s\n' "$(wc -c <"$path" | tr -d ' ')" "${path#./}"; done)

if [[ "$dry_run" == true ]]; then
  step "Dry run: wrangler deploy --dry-run"
  (cd app && npx wrangler deploy --dry-run) || stop "wrangler's dry run failed."
  echo
  echo "Dry run passed: snapshot $version ($file), commit $commit. Nothing was uploaded."
  exit 0
fi

step "Deploying to Cloudflare"
deploy_log="$(mktemp)"
trap 'rm -f "$golden_json" "$deploy_log"' EXIT
(cd app && npx wrangler deploy) 2>&1 | tee "$deploy_log" ||
  stop "wrangler deploy failed. If it asks you to sign in, run 'npx wrangler login' in app/."

address="$(grep -o 'https://[^ ]*workers\.dev' "$deploy_log" | head -1 || true)"
echo
echo "Deployed snapshot $version ($file), commit $commit."
[[ "$without_golden" == false ]] || echo "Search accuracy was NOT checked: the golden set (T027) failed."
echo "Live at: ${address:-the address wrangler printed above}"

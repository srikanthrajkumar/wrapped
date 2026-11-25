#!/usr/bin/env bash
# The personal-data project's public settings for the deployed build (T111; ADR 0001, ADR 0009;
# docs/setup/production.md, "Where the project's address and key go").
#
# They live in one file outside every checkout, so no commit can carry them and a deploy from a
# clean worktree still finds them:
#
#   ~/.config/wrapped/server.env      (or the path in WRAPPED_SERVER_ENV)
#
# It holds, as NAME=value lines, exactly the names in server_env_names below plus any other VITE_
# name app/.env.example lists. The values are public by design (the deployed bundle shows them),
# but this script never prints them. A secret key (sb_secret_…), a service-role key or Google's
# client secret (GOCSPX-…) is refused: it would ship to every phone.

# Always needed: the personal-data project, and Google's web client for its sign-in button
# (signInWithIdToken; ADR 0001). Without the client ID the app's button only reports an error.
server_env_names=(VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY VITE_GOOGLE_CLIENT_ID)
#
# deploy.sh sources this file and calls load_server_env. Run alone, it checks the file:
#   tools/deploy/server-env.sh

server_env_file="${WRAPPED_SERVER_ENV:-$HOME/.config/wrapped/server.env}"

# What load_server_env leaves behind: NAME=value pairs for `env`, the project's address and
# Google's client ID (for the build check), and a reason when it returns 1.
server_env=()
server_url=""
server_google_client=""
server_env_error=""

_server_env_fail() {
  server_env_error="$1"
  return 1
}

# The role inside a legacy JWT key ("anon", "service_role"), or "" for anything else. The key is
# passed in the environment, never on the command line, and nothing of it is printed.
_jwt_role() {
  KEY="$1" node -e '
    const p = (process.env.KEY ?? "").split(".");
    try {
      const body = JSON.parse(Buffer.from(p[1] ?? "", "base64url").toString("utf8"));
      process.stdout.write(p.length === 3 && typeof body.role === "string" ? body.role : "");
    } catch { process.stdout.write(""); }
  '
}

# Reads and checks the file. $1 is the repository root, $2 the public-data project's address.
load_server_env() {
  local root="$1" public_data_url="$2"
  server_env=()
  server_url=""
  server_google_client=""
  server_env_error=""

  [[ -f "$server_env_file" ]] || _server_env_fail "no file at $server_env_file." || return 1

  local names=("${server_env_names[@]}") name
  while IFS= read -r name; do
    [[ " ${names[*]} " == *" $name "* ]] || names+=("$name")
  done < <(grep -oE '^VITE_[A-Z0-9_]+=' "$root/app/.env.example" | tr -d '=')

  local line n v seen=" " number=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    number=$((number + 1))
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    [[ "$line" =~ ^(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] ||
      _server_env_fail "line $number of $server_env_file is not NAME=value." || return 1
    n="${BASH_REMATCH[2]}"
    v="${BASH_REMATCH[3]}"
    if [[ "$v" =~ ^\"(.*)\"$ || "$v" =~ ^\'(.*)\'$ ]]; then v="${BASH_REMATCH[1]}"; fi

    # Refuse anything secret before anything else, whatever name it sits under.
    [[ "$v" != sb_secret_* ]] ||
      _server_env_fail "$n in $server_env_file is a secret key (sb_secret_…). It must never reach the app; use the publishable key." || return 1
    [[ "$(_jwt_role "$v")" != service_role ]] ||
      _server_env_fail "$n in $server_env_file is the service-role key. It must never reach the app; use the publishable (or anon) key." || return 1
    [[ "$v" != GOCSPX-* ]] ||
      _server_env_fail "$n in $server_env_file is Google's client secret. It goes only into Supabase's Google provider, never into the app." || return 1

    [[ " ${names[*]} " == *" $n "* ]] ||
      _server_env_fail "$n in $server_env_file is not a build setting (${names[*]}). Keep everything else out of this file." || return 1
    [[ "$seen" != *" $n "* ]] || _server_env_fail "$n is set twice in $server_env_file." || return 1
    [[ -n "$v" && ! "$v" =~ [[:space:]] ]] ||
      _server_env_fail "$n in $server_env_file is empty or holds a space." || return 1
    seen+="$n "

    case "$n" in
      VITE_SUPABASE_URL)
        [[ "$v" =~ ^https://[a-z0-9]{20}\.supabase\.co$ ]] ||
          _server_env_fail "VITE_SUPABASE_URL in $server_env_file is not a project address like https://<20-letter ref>.supabase.co, with no slash at the end." || return 1
        [[ "$v" != "$public_data_url" ]] ||
          _server_env_fail "VITE_SUPABASE_URL in $server_env_file is the catalog's project (ADR 0009). Seasons go to Wrapped's own project." || return 1
        server_url="$v"
        ;;
      VITE_SUPABASE_ANON_KEY)
        [[ "$v" =~ ^sb_publishable_[A-Za-z0-9_-]+$ || "$(_jwt_role "$v")" == anon ]] ||
          _server_env_fail "VITE_SUPABASE_ANON_KEY in $server_env_file is neither a publishable key (sb_publishable_…) nor the legacy anon key." || return 1
        ;;
      VITE_GOOGLE_CLIENT_ID)
        [[ "$v" =~ ^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$ ]] ||
          _server_env_fail "VITE_GOOGLE_CLIENT_ID in $server_env_file is not a Google client ID like <digits>-<letters>.apps.googleusercontent.com." || return 1
        server_google_client="$v"
        ;;
    esac
    server_env+=("$n=$v")
  done <"$server_env_file"

  for n in "${names[@]}"; do
    [[ "$seen" == *" $n "* ]] || _server_env_fail "$server_env_file has no $n." || return 1
  done
  return 0
}

# Warns when someone else on this machine can read the file. Not a secret, but no one's business.
server_env_mode_note() {
  local mode
  mode="$(stat -c %a "$server_env_file" 2>/dev/null || stat -f %Lp "$server_env_file" 2>/dev/null || true)"
  [[ -z "$mode" || "$mode" =~ 00$ ]] ||
    echo "Note: $server_env_file can be read by other users (mode $mode); chmod 600 it."
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  root="$(cd "$(dirname "$0")/../.." && pwd)"
  public_data_url="$(grep -oE '^public_data_url="[^"]+"' "$root/tools/deploy/deploy.sh" | cut -d'"' -f2)"
  if load_server_env "$root" "$public_data_url"; then
    names_found=()
    for pair in "${server_env[@]}"; do names_found+=("${pair%%=*}"); done
    echo "Server settings look right in $server_env_file: ${names_found[*]} (values not shown)."
    server_env_mode_note
  else
    echo "Server settings: $server_env_error" >&2
    exit 1
  fi
fi

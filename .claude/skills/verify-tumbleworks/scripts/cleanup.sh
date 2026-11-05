#!/usr/bin/env bash
# Release this run's lease; never stop a replacement container or a server another run is using.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$root"
run="${1:?Usage: cleanup.sh <run-id>}"
[[ "$run" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Invalid run ID' >&2; exit 1; }
leases=output/current/verify/.sessions
mkdir -p "$leases"
exec 9>"$leases/.lock"
flock 9
marker="$leases/$run"
if [ -f "$marker" ]; then
  read -r container owned < "$marker"
  rm "$marker"
  current=$(docker compose ps --status running -q dev)
  others=0
  for lease in "$leases"/*; do
    [ -f "$lease" ] || continue
    read -r active _ < "$lease"
    if [ "$active" = "$container" ]; then others=1; fi
  done
  if [ "$owned" = 1 ] && [ "$current" = "$container" ] && [ "$others" = 0 ]; then
    docker stop "$container"
    echo 'stopped the exact dev container this run started'
  else
    echo 'dev server left running: reused, replaced, or another run still uses it'
  fi
else
  echo 'no ownership for this run: dev server left running'
fi
echo 'evidence kept in output/current/verify/'

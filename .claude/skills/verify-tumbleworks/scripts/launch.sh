#!/usr/bin/env bash
# A run owns only the exact container it starts. Reusers get a lease, never stop authority.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$root"
run="${1:?Usage: launch.sh <unique-run-id>}"
[[ "$run" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Use letters, digits, underscores or hyphens for the run ID' >&2; exit 1; }
leases=output/current/verify/.sessions
mkdir -p "$leases"
exec 9>"$leases/.lock"
flock 9
marker="$leases/$run"
[ ! -e "$marker" ] || { echo "Run $run already exists; use a unique ID" >&2; exit 1; }
container=$(docker compose ps --status running -q dev)
owned=0
if [ -z "$container" ]; then
  echo 'dev server not running: starting it'
  docker compose up -d --build dev
  container=$(docker compose ps --status running -q dev)
  [ -n "$container" ] || { echo 'dev container did not start' >&2; exit 1; }
  owned=1
else
  echo 'dev server already running: reusing it'
fi
printf '%s %s\n' "$container" "$owned" > "$marker"
flock -u 9
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "http://localhost:${TUMBLEWORKS_PORT:-5180}/"; then echo "ready; cleanup: $(dirname "$0")/cleanup.sh $run"; exit 0; fi
  sleep 2
done
echo "dev server did not answer; see docker compose logs dev; keep run ID $run for cleanup" >&2
exit 1

#!/usr/bin/env bash
# Makes sure the dev server is up and usable. Starts it only if it is not running, and records that
# this run started it so cleanup.sh stops only what it started.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$root"
marker="output/current/verify/.dev-started-by-verify"
mkdir -p output/current/verify
if [ "$(docker compose ps --status running --services 2>/dev/null | grep -cx dev)" = "0" ]; then
  echo "dev server not running: starting it"
  docker compose up -d --build dev
  touch "$marker"
else
  echo "dev server already running: reusing it (cleanup will leave it running)"
fi
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "http://localhost:${TUMBLEWORKS_PORT:-5180}/"; then echo "ready: http://localhost:${TUMBLEWORKS_PORT:-5180}/ answers"; exit 0; fi
  sleep 2
done
echo "dev server did not answer within 3 minutes; see: docker compose logs dev" >&2
exit 1

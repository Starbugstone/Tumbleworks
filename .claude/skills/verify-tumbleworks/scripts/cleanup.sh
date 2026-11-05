#!/usr/bin/env bash
# Stops the dev server only if launch.sh started it. Never touches evidence under output/current/verify/<run>/,
# other servers (the snapshot preview on 5181 belongs to the owner) or containers this run did not create.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$root"
marker="output/current/verify/.dev-started-by-verify"
if [ -f "$marker" ]; then
  docker compose stop dev
  rm -f "$marker"
  echo "stopped the dev server this verification started"
else
  echo "dev server was already running before verification: left running"
fi
# Journeys run with --rm, so finished e2e containers are already gone; report any still running.
docker compose ps --services --status running | grep -x e2e && echo "an e2e container is still running: wait for its journey to finish" || true
echo "evidence kept in output/current/verify/"

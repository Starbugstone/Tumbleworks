#!/usr/bin/env bash
# Read-only: is the running instance worth driving? Service up, port answering, what code it serves,
# and a real browser boot that reaches a playable board with the whole campaign listed.
set -uo pipefail
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$root"
port="${TUMBLEWORKS_PORT:-5180}"
status=0
docker compose ps dev --format '{{.Service}} {{.State}} {{.Ports}}' | grep -q "running" && echo "PASS dev service running" || { echo "FAIL dev service not running: run scripts/launch.sh"; status=1; }
code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/")"
[ "$code" = "200" ] && echo "PASS http://localhost:$port/ answers 200" || { echo "FAIL http://localhost:$port/ answered $code"; status=1; }
echo "INFO serving the working tree at $(git rev-parse --short HEAD) on $(git branch --show-current), $(git status --porcelain | wc -l | tr -d ' ') changed files"
[ "$status" = 0 ] || exit "$status"
docker compose --profile e2e run --rm -e npm_config_cache=/app/output/.npm-cache e2e npx -y tsx@4.23.15 .claude/skills/verify-tumbleworks/scripts/tw.ts doctor --run "${RUN_ID:-doctor}" 2>&1 | grep -v "Container \|^$"
exit "${PIPESTATUS[0]}"

#!/bin/sh
# Builds a frozen copy of the game on port 5181, so captures aren't interrupted by live reloads.
#   docker compose exec -T dev sh scripts/snapshot.sh
set -e
NODE_ENV=development npx vite build --mode development --outDir output/snapshot --emptyOutDir --logLevel warn
pkill -f 'vite preview' 2>/dev/null || true
nohup npx vite preview --outDir output/snapshot --port 5181 --strictPort --host >/tmp/preview.log 2>&1 &
sleep 2
echo "Snapshot ready"

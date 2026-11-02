// Replays a game copied from the level picker: npx tsx scripts/replay.ts <log.json>
import { readFileSync } from 'node:fs';
import type { ReplayLog } from '../src/engine/replay';
import { initPhysics, Machine } from '../src/machine/machine';
import { replayed } from '../tests/replay-target';

const path = process.argv[2];
if (!path) throw new Error('Usage: tsx scripts/replay.ts <log.json>');
const log = JSON.parse(readFileSync(path, 'utf8')) as ReplayLog;
await initPhysics();
const game = replayed(log);
const fingerprint = game.fingerprint();
console.log(JSON.stringify({ level: log.level, steps: log.steps, actions: log.actions.length, fingerprint, recorded: log.fingerprint,
  recoveries: game instanceof Machine ? game.recoveries : undefined }));
if (fingerprint !== log.fingerprint) {
  console.error('DIVERGED: this machine did not reach the state the player saw. Check the rules changed since it was recorded, or that the device simulates differently.');
  process.exit(1);
}
console.log('MATCH: this run reproduces the state the player saw.');

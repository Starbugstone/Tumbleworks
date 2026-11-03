import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hashBoard } from './level-curve';
import { SCORE_DIR, type ScoredFile } from './level-score';

// Explicit migration of the per-board score files, matching scripts/rehash-scores.ts: S and every measured field stay, only
// the hash moves to the current policy, so `level-score.ts merge` cannot bring stale hashes back into the table.
let moved = 0;
for (const file of readdirSync(SCORE_DIR).filter((name) => name.endsWith('.json'))) {
  const path = `${SCORE_DIR}/${file}`;
  const scored = JSON.parse(readFileSync(path, 'utf8')) as ScoredFile;
  const hash = hashBoard(scored.board as object);
  if (scored.row.hash === hash) continue;
  writeFileSync(path, JSON.stringify({ ...scored, row: { ...scored.row, hash } }));
  moved += 1;
}
console.log(`Migrated ${moved} score files in ${SCORE_DIR}; no scores recomputed.`);

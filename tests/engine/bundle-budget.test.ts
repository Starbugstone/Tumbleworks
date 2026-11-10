import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../../scripts/check-bundle-budget.mjs');
const made: string[] = [];
afterAll(() => made.forEach((path) => rmSync(path, { recursive: true, force: true })));

/** Random bytes do not compress, so these sizes are close to the gzipped sizes. */
function site(files: Record<string, number>, page = '<script src="/assets/index.js"></script>'): string {
  const root = mkdtempSync(join(tmpdir(), 'tumbleworks-budget-'));
  made.push(root);
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'index.html'), page);
  writeFileSync(join(root, 'assets/static-proof.worker-fixture.js'), 'self.onmessage=()=>{};');
  for (const [name, size] of Object.entries(files)) writeFileSync(join(root, 'assets', name), randomBytes(size));
  return root;
}
const check = (root: string) => spawnSync(process.execPath, [script, root], { encoding: 'utf8', env: { ...process.env, TUMBLEWORKS_BUDGET_BYTES: '100000' } });

describe('the first-download budget', () => {
  it('accepts a page under its ceiling', () => {
    const run = check(site({ 'index.js': 80_000 }));
    expect(run.status, run.stderr).toBe(0);
  });
  it('rejects a script over it', () => {
    const run = check(site({ 'index.js': 120_000 }));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('over budget');
  });
  it('counts the Latin font but not the ones the game never shows', () => {
    expect(check(site({ 'index.js': 60_000, 'fredoka-latin-500-normal-abc.woff2': 60_000 })).status).toBe(1);
    expect(check(site({ 'index.js': 60_000, 'fredoka-hebrew-500-normal-abc.woff2': 60_000, 'fredoka-latin-ext-500-normal-abc.woff2': 60_000 })).status).toBe(0);
  });
  it('counts any WASM file', () => {
    expect(check(site({ 'index.js': 60_000, 'physics.wasm': 60_000 })).status).toBe(1);
  });
  it('counts compressed sound bytes even when loaded after the first gesture', () => {
    expect(check(site({ 'index.js': 80_000, 'win.mp3': 30_000 })).status).toBe(1);
    expect(check(site({ 'index.js': 60_000, 'win.mp3': 30_000 })).status).toBe(0);
  });
  it('caps the sound bank independently so it cannot quietly grow inside spare bundle space', () => {
    const run = check(site({ 'index.js': 10_000, 'sound.mp3': 45_001 }));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Audio over budget');
  });
  it('counts the worker and rejects uncounted worker dependencies', () => {
    const large = site({ 'index.js': 60_000 });
    writeFileSync(join(large, 'assets/static-proof.worker-fixture.js'), randomBytes(60_000));
    expect(check(large).status).toBe(1);
    const dependency = site({ 'index.js': 10 });
    writeFileSync(join(dependency, 'assets/static-proof.worker-fixture.js'), 'import "./uncounted.js";');
    expect(check(dependency).stderr).toContain('self-contained');
    for (const code of ['import dependency from "./uncounted.js";', 'import * as dependency from "./uncounted.js";', 'export { dependency } from "./uncounted.js";']) {
      const external = site({ 'index.js': 10 });
      writeFileSync(join(external, 'assets/static-proof.worker-fixture.js'), code);
      expect(check(external).stderr).toContain('self-contained');
    }
    const missing = site({ 'index.js': 10 });
    rmSync(join(missing, 'assets/static-proof.worker-fixture.js'));
    expect(check(missing).stderr).toContain('exactly one');
  });
  it('refuses a page it cannot read a script from, rather than passing it', () => {
    expect(check(site({ 'index.js': 10 }, '<p>nothing linked</p>')).status).not.toBe(0);
  });
});

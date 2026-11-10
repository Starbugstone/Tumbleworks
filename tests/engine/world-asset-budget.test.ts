import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../../scripts/check-bundle-budget.mjs');
const made: string[] = [];
afterAll(() => made.forEach(path => rmSync(path, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'tumbleworks-world-budget-'));
  made.push(root);
  const geometry = join(root, 'assets/world-3d');
  const previews = join(root, 'public/models/projects');
  const site = join(root, 'dist');
  for (const directory of [geometry, previews, join(site, 'assets')]) mkdirSync(directory, { recursive: true });
  writeFileSync(join(site, 'index.html'), '<script src="/assets/index.js"></script>');
  writeFileSync(join(site, 'assets/index.js'), 'console.log("fixture")');
  writeFileSync(join(site, 'assets/static-proof.worker-fixture.js'), 'self.onmessage=()=>{};');
  for (const name of ['terrain-runtime.json', 'kit-runtime.json']) writeFileSync(join(geometry, name), '{}');
  return { geometry, previews, site };
}
function check(value: ReturnType<typeof fixture>, budget = '2125000') {
  return spawnSync(process.execPath, [script, value.site], {
    encoding: 'utf8', env: { ...process.env, TUMBLEWORKS_WORLD_ASSET_DIRECTORY: value.geometry, TUMBLEWORKS_BUDGET_BYTES: budget },
  });
}

describe('independent world art budgets', () => {
  it('accepts runtime geometry under its compressed ceiling without adding it to the JS transfer twice', () => {
    const value = fixture();
    const bytes = randomBytes(80_000);
    writeFileSync(join(value.geometry, 'kit-runtime.json'), bytes);
    expect(gzipSync(bytes, { level: 9 }).length).toBeLessThan(120_000);
    const run = check(value, '1000');
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('World assets: geometry');
  });
  it('rejects geometry above 120,000 compressed bytes even with spare first-download space', () => {
    const value = fixture();
    const bytes = randomBytes(121_000);
    expect(gzipSync(bytes, { level: 9 }).length).toBeGreaterThan(120_000);
    writeFileSync(join(value.geometry, 'kit-runtime.json'), bytes);
    const run = check(value);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('World geometry over budget:');
    expect(run.stderr).toContain('of 120000');
  });
  it('counts actual PNG transfer bytes recursively, including future mechanic cues', () => {
    const value = fixture();
    mkdirSync(join(value.previews, 'mechanics'));
    writeFileSync(join(value.previews, 'reward.png'), Buffer.alloc(60_000));
    writeFileSync(join(value.previews, 'mechanics/cue.PNG'), Buffer.alloc(40_000));
    expect(check(value).status).toBe(0);
    writeFileSync(join(value.previews, 'mechanics/cue.PNG'), Buffer.alloc(40_001));
    const run = check(value);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('World previews over budget: 100001 bytes of 100000');
  });
  it('allows an absent optional preview directory', () => {
    const value = fixture();
    rmSync(value.previews, { recursive: true });
    expect(check(value).status).toBe(0);
  });
  it.each(['terrain-runtime.json', 'kit-runtime.json'])('refuses missing required %s instead of measuring nothing', name => {
    const value = fixture();
    rmSync(join(value.geometry, name));
    const run = check(value);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Missing required world runtime asset:');
    expect(run.stderr).toContain(name);
  });
});

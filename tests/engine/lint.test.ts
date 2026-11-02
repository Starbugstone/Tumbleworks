import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const sandbox = mkdtempSync(join(tmpdir(), 'tumbleworks-lint-'));
copyFileSync(join(root, '.oxlintrc.json'), join(sandbox, '.oxlintrc.json'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

function lint(file: string, source: string): { ok: boolean; output: string } {
  const path = join(sandbox, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  const run = spawnSync(join(root, 'node_modules/.bin/oxlint'), ['--deny-warnings', '-c', '.oxlintrc.json', file], { cwd: sandbox, encoding: 'utf8' });
  return { ok: run.status === 0, output: run.stdout + run.stderr };
}

describe('the determinism lint', () => {
  it.each([
    ['src/machine/bad.ts', 'export const pick = Math.random();'],
    ['src/sim/bad.ts', 'export const at = Date.now();'],
    ['src/loop/bad.ts', 'export const at = performance.now();'],
    ['src/puzzles/bad.ts', 'export const at = new Date();'],
    ['src/loop/drawn.ts', "import * as THREE from 'three';\nexport const v = new THREE.Vector3();"],
    ['src/machine/page.ts', 'export const canvas = document.body;'],
    ['src/machine/trig.ts', 'export const turn = Math.cos(1);'],
    ['src/engine/belt-path.ts', 'export const turn = Math.hypot(1, 2);'],
  ])('rejects %s', (file, source) => {
    expect(lint(file, source).ok).toBe(false);
  });

  it.each([
    ['src/view/confetti.ts', 'export const left = Math.random() * 100;'],
    ['src/audio.ts', 'export const pitch = Math.random() + Date.now();'],
    ['src/machine/good.ts', "import { sin } from '../engine/exact-math';\nexport const jitter = (id: number) => sin(id * 12.9898) + Math.sqrt(id);"],
    ['src/view/spin.ts', 'export const spin = Math.sin(1);'],
  ])('accepts %s', (file, source) => {
    expect(lint(file, source)).toMatchObject({ ok: true });
  });

  it('passes on the project itself', () => {
    expect(execFileSync(join(root, 'node_modules/.bin/oxlint'), ['--deny-warnings'], { cwd: root, encoding: 'utf8' })).toContain('0 errors');
  });
});

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const sandboxes: string[] = [];
afterEach(() => { for (const path of sandboxes.splice(0)) rmSync(path, { recursive: true, force: true }); });

function sandbox(container = '') {
  const root = mkdtempSync(join(tmpdir(), 'tw-verification-'));
  sandboxes.push(root);
  const relative = '.claude/skills/verify-tumbleworks/scripts';
  const scripts = join(root, relative);
  mkdirSync(scripts, { recursive: true });
  for (const file of ['launch.sh', 'cleanup.sh']) copyFileSync(resolve(relative, file), join(scripts, file));
  const bin = join(root, 'bin'); mkdirSync(bin);
  const state = join(root, 'container'); const log = join(root, 'actions');
  writeFileSync(state, container); writeFileSync(log, '');
  writeFileSync(join(bin, 'docker'), `#!/bin/sh
printf '%s\\n' "$*" >> "$TW_TEST_LOG"
case "$*" in
  'compose ps --status running -q dev') cat "$TW_TEST_CONTAINER" ;;
  'compose up -d --build dev') printf 'created-container\\n' > "$TW_TEST_CONTAINER" ;;
  'stop created-container') : > "$TW_TEST_CONTAINER" ;;
  *) exit 9 ;;
esac
`, { mode: 0o755 });
  writeFileSync(join(bin, 'curl'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const run = (script: string, id: string) => execFileSync('bash', [join(scripts, script), id], {
    encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TW_TEST_LOG: log, TW_TEST_CONTAINER: state },
  });
  return { root, state, run, actions: () => readFileSync(log, 'utf8') };
}

it.each([false, true])('never stops a reused service (legacy marker: %s)', (stale) => {
  const test = sandbox('owner-container\n');
  if (stale) {
    const dir = join(test.root, 'output/current/verify'); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.dev-started-by-verify'), '');
  }
  test.run('launch.sh', 'reuse'); test.run('cleanup.sh', 'reuse');
  expect(test.actions()).not.toContain('stop ');
});

it('stops only the exact container started by this run', () => {
  const test = sandbox();
  test.run('launch.sh', 'owner'); test.run('cleanup.sh', 'owner');
  expect(test.actions()).toContain('stop created-container');
  expect(readFileSync(test.state, 'utf8')).toBe('');
});

it('preserves a replacement container', () => {
  const test = sandbox(); test.run('launch.sh', 'owner');
  writeFileSync(test.state, 'replacement\n'); test.run('cleanup.sh', 'owner');
  expect(test.actions()).not.toContain('stop ');
});

it('preserves a container shared by overlapping runs and never transfers stop authority', () => {
  const test = sandbox(); test.run('launch.sh', 'owner'); test.run('launch.sh', 'guest');
  test.run('cleanup.sh', 'owner'); test.run('cleanup.sh', 'guest');
  expect(test.actions()).not.toContain('stop ');
  expect(readFileSync(test.state, 'utf8')).toContain('created-container');
});

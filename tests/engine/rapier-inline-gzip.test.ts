import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { gzipRapierInlineWasm, rapierInlineGzip } from '../../scripts/rapier-inline-gzip';

const source = readFileSync(new URL('../../node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs', import.meta.url), 'utf8');
const candidate = gzipRapierInlineWasm(source);
const directory = mkdtempSync(join(tmpdir(), 'tumbleworks-rapier-gzip-'));
const originalExpression = /oC\.toByteArray\("([A-Za-z0-9+/=]+)"\)\.buffer/;
const compressedExpression = /\(yield new Response\(new Blob\(\[oC\.toByteArray\("([A-Za-z0-9+/=]+)"\)\]\)\.stream\(\)\.pipeThrough\(new DecompressionStream\("gzip"\)\)\)\.arrayBuffer\(\)\)/;
const payload = compressedExpression.exec(candidate)?.[1];
if (!payload) throw new Error('Missing transformed payload');
let serial = 0;
async function load(code: string): Promise<typeof import('@dimforge/rapier3d-compat')> {
  const file = join(directory, `rapier-${serial++}.mjs`);
  writeFileSync(file, code);
  return import(/* @vite-ignore */ pathToFileURL(file).href);
}
afterAll(() => rmSync(directory, { recursive: true, force: true }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('the pinned Rapier inline WASM transport', () => {
  it('is build-only and leaves every other vendor byte intact', () => {
    expect(rapierInlineGzip()).toMatchObject({ apply: 'build', enforce: 'pre' });
    expect(candidate.replace(compressedExpression, '<wasm>')).toBe(source.replace(originalExpression, '<wasm>'));
  });
  it('decodes to exactly the original WASM, independently of the runtime decoder', () => {
    const raw = Buffer.from(originalExpression.exec(source)![1]!, 'base64');
    const restored = gunzipSync(Buffer.from(payload, 'base64'));
    expect(restored.equals(raw)).toBe(true);
    expect(restored.length).toBe(3_082_103);
    expect([...restored.subarray(0, 8)]).toEqual([0, 97, 115, 109, 1, 0, 0, 0]);
    expect(createHash('sha256').update(restored).digest('hex')).toBe('17cfa80eebd8de0291b948496dbffba724b98b489687f8272ca236a7bbf1dd4b');
  });
  it('rejects changed vendor glue and payload before building', () => {
    expect(() => gzipRapierInlineWasm(source + '\n')).toThrow('vendor preimage changed');
    expect(() => gzipRapierInlineWasm(source.replace('AGFzbQEAAAAB', 'BGFzbQEAAAAB'))).toThrow('vendor preimage changed');
  });
  it('preserves public exports and asynchronous, repeatable initialization', async () => {
    const baseline = await load(source), compressed = await load(candidate);
    expect(Object.keys(compressed)).toEqual(Object.keys(baseline));
    expect(Object.keys(compressed.default)).toEqual(Object.keys(baseline.default));
    for (const key of Object.keys(baseline) as (keyof typeof baseline)[]) expect(typeof compressed[key]).toBe(typeof baseline[key]);
    for (const module of [baseline, compressed]) {
      let settled = false;
      const ready = module.init();
      expect(ready).toBeInstanceOf(Promise);
      void ready.then(() => { settled = true; });
      expect(settled).toBe(false);
      expect(await ready).toBeUndefined();
      expect(await module.init()).toBeUndefined();
      expect(await module.default.init()).toBeUndefined();
      expect(module.version()).toBe('0.21.0');
    }
  });
  it.each([['baseline', source], ['compressed', candidate]])('%s preserves the loader rejection', async (_name, code) => {
    const module = await load(code);
    const error = new Error('WASM loader sentinel');
    vi.spyOn(WebAssembly, 'instantiate').mockRejectedValue(error);
    await expect(module.init()).rejects.toBe(error);
  });
  it('rejects a corrupt compressed payload without an uncompressed fallback', async () => {
    const module = await load(candidate.replace(payload, 'A' + payload.slice(1)));
    await expect(module.init()).rejects.toThrow();
  });
  it('rejects unsupported decompression through the existing init Promise', async () => {
    const module = await load(candidate);
    vi.stubGlobal('DecompressionStream', undefined);
    const ready = module.init();
    expect(ready).toBeInstanceOf(Promise);
    await expect(ready).rejects.toBeInstanceOf(TypeError);
  });
});

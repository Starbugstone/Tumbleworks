import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';

const VENDOR_SHA256 = '02dc6a4e2fffc013bab08fbb44fa68f501d8303615e9afe4c7d89ad4eedda0d0';
const WASM_SHA256 = '17cfa80eebd8de0291b948496dbffba724b98b489687f8272ca236a7bbf1dd4b';
const WASM_BYTES = 3_082_103;
const PAYLOAD = /oC\.toByteArray\("([A-Za-z0-9+/=]+)"\)\.buffer/g;
const sha256 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

/** Only the pinned compat bundle's inline transport changes; its loader and WASM stay intact. */
export function gzipRapierInlineWasm(source: string): string {
  if (sha256(source) !== VENDOR_SHA256) throw new Error('Rapier inline gzip: vendor preimage changed; review the pinned package before rebuilding');
  const matches = [...source.matchAll(PAYLOAD)];
  const match = matches[0];
  if (matches.length !== 1 || !match?.[1]) throw new Error('Rapier inline gzip: expected exactly one embedded WASM payload');
  const raw = Buffer.from(match[1], 'base64');
  if (raw.length !== WASM_BYTES || sha256(raw) !== WASM_SHA256) throw new Error('Rapier inline gzip: WASM preimage changed');
  const compressed = gzipSync(raw, { level: 9 }).toString('base64');
  if (!gunzipSync(Buffer.from(compressed, 'base64')).equals(raw)) throw new Error('Rapier inline gzip: compressed WASM round-trip failed');
  // FC is already an async generator wrapper. This yield must finish before the existing EI loader.
  const decoded = `(yield new Response(new Blob([oC.toByteArray("${compressed}")]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer())`;
  return source.replace(match[0], decoded);
}

export function rapierInlineGzip(): Plugin {
  let transformed = false;
  return {
    name: 'rapier-inline-gzip',
    apply: 'build',
    enforce: 'pre',
    buildStart() { transformed = false; },
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs')) return null;
      const code = gzipRapierInlineWasm(source);
      transformed = true;
      return { code, map: null };
    },
    buildEnd(error) {
      if (!error && !transformed) this.error('Rapier inline gzip: pinned vendor module was not transformed');
    },
  };
}

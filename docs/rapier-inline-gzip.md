# Rapier's inline WASM transport

Production builds gzip the WASM already embedded in the pinned
`@dimforge/rapier3d-compat` 0.21.0 module. The build-only Vite plugin in
[scripts/rapier-inline-gzip.ts](../scripts/rapier-inline-gzip.ts) checks the exact
vendor SHA before replacing one inline expression. It changes neither the
installed package nor the decoded WASM instructions. Development keeps the
original vendor path.

Each build inflates its own compressed payload and checks exact byte equality
before emitting it, including when the hosting server uses a different zlib.

The existing async `init()` waits for the browser's `DecompressionStream('gzip')`
then passes the restored ArrayBuffer to the original loader. Public exports and
the loader's Promise rejection remain intact. There is no extra request,
dependency, alternate WASM or uncompressed fallback. A changed vendor file or a
missing transform fails the build so a dependency update requires an explicit
review of this helper and its tests.

Compression Streams is available in [Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)
and [Chromium 80 onward](https://developer.chrome.com/blog/compression-streams-api).
These cover the supported modern-phone browser baseline; older browsers without
this API reject initialization through the existing boot error path. Physical
phone startup and memory remain separate checks from desktop browser evidence.

Run `npm run typecheck`, `npm run lint`,
`npx vitest run tests/engine/rapier-inline-gzip.test.ts --maxWorkers=1` and
`npm run build`. The build retains the existing first-download gate and counted
closure. The focused regression checks independent inflate equality, unchanged
vendor glue, public exports, repeated init, loader failures, corruption and an
unsupported decoder. Production startup must also be tested against the built
page: a dev-server pass cannot exercise this build-only decoder.

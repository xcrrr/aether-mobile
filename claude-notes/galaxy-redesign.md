# Core / Second Brain → 3D Memory Galaxy (2026-06-29)

Reworked the Core (Second Brain) feature from a flat SVG "globe" into a full-screen,
GPU-accelerated 3D **memory galaxy** (reference: hyperagent.com NASA NEO dashboard, but for
memories, motion slowed down).

## What changed
- **Renderer is now WebGL in a WebView**, not SVG. We finally wired up the previously *orphaned*
  self-contained asset `app/assets/graph/graph.html` (inlined `three` + `three-spritetext` +
  `3d-force-graph`; `metro.config.js` already bundles `.html`). Nothing imported it before.
- **`app/assets/graph/graph.config.js`** rewritten into the galaxy scene: deep-space backdrop,
  two-layer starfield, violet nebula, central glowing "sun", category-colored additive glow-
  sprite stars, orbital trail rings, glowing links, gentle per-category clustering, and **slow**
  ambient motion. Same RN bridge as before (`window.__setGraphData` / `__focusNode` /
  new `__setPaused`; postMessage `ready` / `nodeTap`).
  - After editing the config you MUST run `node assets/graph/build.js` to regenerate
    `graph.html` (it swaps the trailing config IIFE; the marker line
    `// ---- Aether Second Brain graph config (Obsidian-style) ----` must stay as line 1).
- **New `app/src/components/secondbrain/GalaxyView.tsx`** — WebView renderer + data bridge.
  Drop-in for the old `Graph3D` (`data` / `onNodeTap` / `focusKey`). Pauses the GL loop on blur
  via `useFocusEffect`. Has loading + empty overlays.
- **New `app/src/components/secondbrain/MemoryListPanel.tsx`** — the list + search/filter +
  add-fact modal + enable/status/danger controls, now an animated right-side slide-in drawer.
- **`SecondBrainScreen.tsx`** is galaxy-first: full-bleed `GalaxyView`, floating top bar (back /
  "Core" + count / list button), new-memory toast, shared edit modal. No more List/Graph segment
  toggle or fullscreen modal.

## Removed (dead SVG path)
`Graph3D.tsx`, `projection.ts`, `forceLayout.ts` and their tests (`projection.test.ts`,
`forceLayout.test.ts`). Verified nothing else imported them.

## Unchanged
Data layer: `graphData.ts` (`toGraphData`, `CATEGORY_COLORS`), `MemoryStore`, `types.ts`,
extraction. The galaxy is fed the exact same `{nodes, links}` payload.

## 2026-06-30 fix — infinite "Charting your galaxy…"
First device build hung on the loader forever. Cause: the old scene used the inlined
`3d-force-graph` bundle and assumed a global `THREE`, which that bundle does NOT expose →
the scene IIFE threw before posting `ready`, so the RN loader never cleared.

Fix (rewrote the renderer to remove all ambiguity):
- Dropped `3d-force-graph` + `three-spritetext`. `graph.html` now bundles ONE inlined
  `node_modules/three/build/three.min.js` (UMD, sets global `THREE`) + a hand-rolled scene
  `app/assets/graph/galaxy.scene.js` (custom galaxy: starfield, nebula, sun, category-clustered
  glow-sprite stars, orbital rings, link lines, touch orbit/pinch/tap, slow motion).
- `app/assets/graph/build.js` rewritten to compose `graph.html` from three.min.js + galaxy.scene.js.
  `graph.config.js` deleted. `graph.html` is now ~681 KB (was 1.9 MB).
- Scene posts `ready` in try/catch and reports failures via postMessage `{type:'error'}`;
  `window.onerror` too.
- `GalaxyView.tsx`: shows the error on screen + a 12 s timeout fallback, so it can never hang.
- NOTE: must re-run `node assets/graph/build.js` after editing `galaxy.scene.js`, and **rebuild
  the APK** for the fix to land.

## Verify on device (not done here — needs Gradle build on the Linux box)
- It's an asset + JS change. A normal `./gradlew assembleRelease` should re-bundle, but if the
  old `graph.html` sticks, clear the generated bundle/assets dirs first (see `app/CLAUDE.md`
  "force fresh Hermes bundle").
- Open Core: full-screen galaxy, slow motion, glowing category-colored stars, central sun,
  orbital trails, links; tap a star → focuses + opens the fact; list button → slide-in works;
  empty state; works offline (asset is bundled). Screenshot into `design-artifacts/`.

`npm run typecheck` + `npm test` (192) both green.

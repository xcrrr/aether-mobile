# Second Brain Polish — Plan (looks + functionality)

Branch: feat/vision-secondbrain-graph (worktree ~/aetherbeta-vsg). Builds on the first pass.

## Issues found in audit
1. `markStale()` exists but is NEVER called → decay dead code.
2. No `updateEntry` (can't correct a fact), no `deleteEdge`, no manual add.
3. Node popup + list are view/delete only (user wants real curation).
4. No search / no category filter.
5. GRAPH: `nodeLabel('label')` is a HOVER tooltip → invisible on touch. No persistent labels → does not feel like Obsidian on a phone.
6. GRAPH: no legend, no tap-to-highlight-connected (Obsidian dims the rest), auto-rotate never pauses on interaction, forces untuned, no link motion.

## Wave A — store + extraction (TDD)
Files: `src/secondbrain/MemoryStore.ts` (+test), `src/secondbrain/MemoryExtractor.ts` (+test).
- `updateEntry(id, { value?, category? })` → patch + `updatedAt=lastSeenAt=now`, `stale:false`.
- `deleteEdge(id)`.
- `addManualEntry({ category, key, value })` → upsert via addOrUpdateEntry path with `confidence:1`, `sourceConversationId:'manual'`.
- `purgeStale()` → drop `stale` entries AND their dangling edges.
- Wire decay: `markStale()` called (a) in `onRehydrateStorage` after backfill, (b) at end of `extractFromConversation` (after recordExtraction).
- Extractor: cap `value` to 200 chars in `validateEntry`; prompt nudge "values concise (<=12 words), reuse existing keys, no duplicates".
- Non-hook `MemoryStore` accessors for the new fns.

## Wave B — graph visuals (Obsidian feel)
Files: `assets/graph/graph.html` (regenerate inlined), `src/components/secondbrain/graphData.ts` (+test), `src/components/secondbrain/Graph3D.tsx`.
- Vendor + INLINE order into graph.html: `three` UMD (global THREE) → `three-spritetext` (global SpriteText) → `3d-force-graph` (bundles own three). All offline.
- Persistent labels: `.nodeThreeObjectExtend(true).nodeThreeObject(n => { const s=new SpriteText(n.label); s.color='#EAEAF0'; s.textHeight=4; s.backgroundColor='rgba(11,11,15,0.55)'; s.padding=1.5; s.borderRadius=2; s.position.y=8; return s; })`.
- `graphData.toGraphData`: add `category` to `GraphNode`; add truncated `label` (<=24 chars, ellipsis) while popup still shows full value from the store.
- Legend overlay: HTML div (top-left) built in graph.html from distinct `node.category`+`node.color` in the current data; tap a legend row → filter to that category (postMessage to RN optional; min: visual legend).
- Tap highlight (Obsidian): on `onNodeClick`, compute neighbor node ids + incident links; dim non-highlighted nodes/links to ~0.12 opacity, highlight selected + neighbors; tapping background clears. STILL post `{type:'nodeTap',key}` to RN for the popup.
- Auto-rotate pauses on interaction: hook `Graph.controls()` ('start' → stop spin, 'end' → resume after 4 s idle).
- Subtle motion + shape: `.linkDirectionalParticles(1).linkDirectionalParticleWidth(1.4).linkDirectionalParticleSpeed(0.006)`; `.d3Force('charge').strength(-90)`; `.linkWidth(0.8).linkOpacity(0.35)`; `.nodeOpacity(0.95)`.
- Graph3D: accept optional `focusKey` → inject `window.__focusNode(key)` (centers camera on a node) for "tap list row → see it in graph"; and a `categoryFilter` passed through data (RN filters before sending — simplest, keep filtering in RN).

## Wave C — screen redesign (looks + curation)
File: `src/components/settings/SecondBrainScreen.tsx`.
- Search `TextInput` (filters list by key/value, case-insensitive).
- Category filter chips row (color dot + label + count) doubling as legend; multi-select; filters BOTH list and the data sent to Graph3D.
- Editable node popup: Edit (TextInput on value) + Delete + Done, via `updateEntry`/`deleteEntry`.
- "Add fact" button → modal (category chips + key + value) → `addManualEntry`.
- Fullscreen graph toggle (expand into a full-screen Modal).
- Polish: stat row, empty state, and a "Clear stale (N)" action shown only when stale entries exist (`purgeStale`).
- Keep "Analyze current chat now" + "Clear all".

## Verification
`npx tsc --noEmit` clean + `npm test` green after each wave. Rebuild APK at the end (arm64), copy to ~/aetherbeta-vsg-latest.apk. Device run confirms labels render + gestures.

## Invariants
Single llama context unchanged (no LLM-path edits except extractor prompt/value cap). AsyncStorage rows small. Graph stays fully offline (all libs inlined).

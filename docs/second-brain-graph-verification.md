# Second Brain Graph — Verification

## Automated (already run, all green)

```bash
cd app
npm run typecheck   # tsc strict — clean
npx jest --silent   # 419 tests / 32 suites — pass
```

`graphData.test.ts` (24 tests) covers:

- compact volume that scales with count (18 vs 200 memories)
- tiny graph (3 memories) stays inside its globe radius (<16)
- no NaN/Infinity in positions, radius, or cluster centers
- deterministic layout: identical data ⇒ identical positions and link ids
- link types restricted to explicit / discussed_together / shared_topic
- shared-topic links name the shared word and stay weak (<0.55 strength)
- corpus-generic words (>40% of memories) create zero links
- keyword-hub guard: 5 candidate pairs on one node cap at 3
- pair-level dedupe: shared_topic never doubles an existing relationship,
  discussed_together never doubles an explicit edge
- same-conversation star topology (no chains/meshes), manual memories get no
  derived conversation links, deleted memories leave no dangling links

## On-device (Android) checklist

Build and install the APK, then:

1. **Fresh brain (0 memories)** — open Core: empty-state copy, no graph
   artifacts, no errors.
2. **1–3 memories** — add manual memories or run one "Analyze now". Enter
   Core: nodes form one compact, centered cluster filling a comfortable
   portion of the screen. Not tiny dots in a void; not clipped by the header
   or the status pill.
3. **Relationship count** — with ≥2 memories that share a word (e.g. two
   facts mentioning the same project name) the status pill must show ≥1
   relationship and a visible edge must connect them.
4. **5–10 related memories** — memories from the same conversation form a
   visible star; different topics drift to distinct regions of the same
   globe. No isolated islands flung to corners.
5. **Tap a node** — camera glides in; the detail sheet's "Connected to"
   explanation matches the edge type (same conversation / shared word /
   extracted relation). Tap empty space: camera returns to the full-globe
   overview.
6. **Manual exploration** — rotate and pinch, then wait for the simulation to
   settle: the camera must NOT snap back on its own. Double-tap empty space:
   view resets to the fitted overview.
7. **Growth framing** — note the zoom level, add several new memories
   (analyze a chat), re-enter Core: the globe is larger/denser and the camera
   automatically frames the whole thing.
8. **Stability across entries** — leave and re-enter Core three times: the
   layout is the same arrangement each time (no random re-shuffle).
9. **Rotation/labels** — labels stay small, constant-size, non-overlapping;
   nodes are smooth spheres, edges subtle but clearly visible on the #181818
   background.
10. **Performance** — 60+ memories: entry animation settles in ~1s, rotation
    stays smooth, no WebView crash (`GraphErrorBoundary` never triggers).
11. **Retrieval unaffected** — chat still injects memories; deleting a memory
    from the detail sheet removes its node and edges immediately.

If any step fails, capture a screenshot into `design-artifacts/` and note the
memory count + step number.

# Note for Codex — Second Brain graph redesign (2026-07-02)

The Second Brain graph was structurally repaired (it used to render a few
scattered dots with 0 relationships). Architecture changes:

- `app/src/components/secondbrain/graphData.ts`: `GraphData` now carries a
  `layout` field (`radius` + `clusterCenters`) consumed by the WebView scene.
  New third link tier `shared_topic` (lexical overlap, hub-guarded, capped).
  Seeding is count-scaled (`R = 8 + 5.5·∛count`) and deterministic.
- `app/assets/graph/knowledge-graph.scene.js`: forces rebuilt (containment at
  globe radius, cluster anchors from payload), FOV-based camera auto-fit with
  viewport padding (`window.__setViewportPadding`), user-interaction guard,
  custom sphere node meshes, constant-screen-size labels. After editing this
  file you MUST run `node assets/graph/build.js` to regenerate `graph.html`.
- `MemoryGraphView` gained `overlayTop`/`overlayBottom` props;
  `SecondBrainScreen` passes safe-area + header/status bands.

Full rationale: `docs/second-brain-graph-redesign.md`.
Device checklist: `docs/second-brain-graph-verification.md`.
Do not reintroduce fixed category anchors or the old radius formulas.

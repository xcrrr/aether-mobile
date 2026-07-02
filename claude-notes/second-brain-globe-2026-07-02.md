# Second Brain globe repair — 2026-07-02 (Claude)

Architecture changes Codex should know about:

## Renderer (`app/assets/graph/knowledge-graph.scene.js`)
- **Never call `graph.refresh()`.** In the bundled three-forcegraph, refresh flushes the
  node data-mapper: every mesh is recreated at (0,0,0), and positions are only re-applied
  by `tickFrame()` — which no longer runs once the layout has settled. That was the
  "tapped node disappears, only the ring remains" bug. Selection restyling is now done
  in place: cached-material swap + scale mutation via a `meshByNode` registry.
- **Edges are no longer forcegraph objects.** `linkVisibility(false)`; a single
  `THREE.LineSegments` with RGBA vertex colors (itemSize-4 color attribute → vertex
  alpha) renders all edges in one draw call. Positions update per engine tick, colors on
  selection change.
- Fog tracks camera distance for depth cueing; containment force is firmer at the globe
  radius; category anchors are stronger. `graph.html` is rebuilt from
  `node assets/graph/build.js` (needs node_modules) — already rebuilt and committed here.

## Graph data (`app/src/components/secondbrain/graphData.ts`)
- New link type `same_cluster`: per visual category, minimal spanning links (Kruskal over
  keyword overlap, then time proximity) guarantee each category cluster is one connected
  component. Grounded + explained per link. Keyword floor now 4 chars.

## Screen (`SecondBrainScreen.tsx`, `MemoryGraphView.tsx`)
- `MemoryGraphView` is a forwardRef exposing `resetView()`; recenter button added.
- Closing the detail sheet or pressing Android back deselects; `overlayBottom` follows
  the measured sheet height so the focused node stays in the visible band.

Typecheck + 482 jest tests green. Device validation still pending.

# Second Brain — Dense 3D Knowledge Globe Redesign

Date: 2026-07-02. Files: `app/src/components/secondbrain/graphData.ts`,
`app/assets/graph/knowledge-graph.scene.js` (bundled into `graph.html`),
`app/src/components/secondbrain/MemoryGraphView.tsx`,
`app/src/components/settings/SecondBrainScreen.tsx`.

## Root causes of the old sparse graph

1. **Seeding ignored graph size.** `seededPosition` placed every node 14–78
   world units out from category anchors that were only ~12 units apart. Three
   memories landed on a huge, mostly empty shell in random directions. Node
   count never entered the formula, so a small brain got the same enormous
   canvas as a large one. Low importance pushed nodes *farther out*, inverting
   density.
2. **The physics preserved the scatter.** `compactShapeForce` drove every
   low-connectivity node toward a target radius of ~70–95 units regardless of
   how many nodes existed. Even if seeding had been compact, the simulation
   would have re-scattered it.
3. **Camera framing had a floor of 150 units** and a naive `bounds × 1.88`
   multiplier, no FOV-based fit, and no awareness of the header/status
   overlays or safe areas.
4. **Relationships starved.** The only link sources were model-extracted
   `links` (capped at 2–3 per extraction, and auto-extraction is frequently
   preempted) and a same-conversation star (zero links for manual memories or
   one-fact conversations). Memories with obvious shared context showed
   "0 relationships".

## Relationship strategy (grounded, three tiers)

| Type | Source | Strength | Visual |
|---|---|---|---|
| `explicit` | Model-extracted relation from the user's own words | 1.0 | brightest, widest |
| `discussed_together` | Facts saved from the same conversation (star from the most important memory; no chains, no meshes) | 0.55 | medium |
| `shared_topic` | Both memory texts contain the same meaningful word(s) | 0.26–0.5 | dimmest, thinnest |

`shared_topic` guards (all in `addSharedTopicLinks`):

- Only words ≥5 chars, minus an extended stopword list.
- A word carried by **more than 6 nodes** never pairs (keyword-hub guard).
- A word carried by **>40% of the corpus** (at ≥5 memories) never pairs
  (corpus-generic guard).
- Rarer shared words score higher (1/(carriers−1) idf-style weight).
- Max **3 shared-topic links per node**, strongest overlaps first.
- A pair already connected by `explicit` or `discussed_together` is never
  duplicated; `discussed_together` also skips pairs that have an `explicit`
  edge.
- Every link carries a human-readable explanation naming the shared word, so
  nothing is presented as a fact the system doesn't have.

Nothing is fabricated: no index bridges, no category all-to-all, no invented
semantic claims. Category grouping is expressed **spatially** (cluster
placement), never as an edge.

## Cluster strategy

Visual categories (projects/work/people/…) are the cluster key. Only
categories actually present get a cluster center; centers are distributed
deterministically on a Fibonacci sphere at 0.55 × globe radius (a single
category sits at the origin). Cluster identity is enforced by layout forces,
not by fake edges.

## Layout strategy

Two cooperating layers, agreeing on the same geometry via the `layout` field
of `GraphData` (`{ radius, clusterCenters }`):

1. **Deterministic seeding** (`assignPositions`): globe radius
   `R = 8 + 5.5·∛count` — density stays roughly constant, so the globe grows
   in radius *and* density instead of scattering. Each node gets a hashed,
   stable position inside its cluster's local ball (volume-uniform radial
   distribution, important nodes slightly inward, stale nodes slightly
   outward). Same data ⇒ same layout on every entry.
2. **3D force simulation** (three-forcegraph / d3-force-3d) refines from the
   seeds: charge repulsion (distanceMax scaled to R), link attraction scaled
   by relationship strength, cluster-anchor pull (stronger for degree < 2 so
   singletons stay with their group), mild central gravity, and a **soft
   spherical containment** at 1.05 × R that makes runaway scatter impossible.
   All custom forces sanitize NaN/Infinity coordinates.

## Camera auto-fit

- On data load and on simulation settle, the scene computes the true 3D
  bounds and places the camera at `distance = maxR·1.14 / min(tanV, tanH)`,
  where `tanV` is the vertical FOV tangent scaled by the **usable** viewport
  height (screen minus header/status overlays) and `tanH` accounts for
  aspect. Small graphs fill the screen; large graphs automatically get a more
  distant framing; nothing clips.
- `SecondBrainScreen` passes overlay bands (`insets.top + 64`,
  `insets.bottom + 56`) through `MemoryGraphView` to
  `window.__setViewportPadding`; the look-at point is shifted along
  screen-up so the globe centers in the unobstructed band.
- **User exploration is respected**: any rotate/pinch sets a `userAdjusted`
  flag; auto-refit is suppressed until the node count changes, the user
  double-taps (reset view), or taps empty space (clear focus → overview).

## Small vs large graphs

- 3 memories: R ≈ 16, camera ≈ 45–55 units — a visible, substantial seed
  cluster, not dots in a void.
- 60 memories: R ≈ 30 with per-category sub-clusters and visible bridges.
- 600+ memories: R ≈ 55; framing distance grows automatically; label budget
  and hub guards keep it readable.

## Visual hierarchy

- Nodes: smooth shared-geometry spheres (24-segment), `MeshStandardMaterial`
  with mild emissive so the dark side never goes black; size from importance
  + connectivity, capped at 2.35 val.
- Edges: opacity 0.52; strong links brighter/wider (`#A79DB4`, 0.5), weak
  shared-topic links dimmer/thinner (`#5F5966`, 0.24).
- Labels: constant on-screen size (scaled by camera distance each frame),
  small translucent pills, priority + collision budget; selection expands the
  budget around the focused node.

## Limitations (real)

- `shared_topic` is lexical overlap, not embeddings — synonyms ("gym" vs
  "fitness") don't connect. On-device embedding similarity is a possible
  future tier.
- Relationship extraction is still capped per pass and preemptible; the graph
  reflects only what has actually been extracted or is textually shared.
- Genuinely disconnected memories remain visually attached only to their
  cluster region — honest, by design.
- The force simulation is deterministic in practice because seeds are
  deterministic and coincident positions never occur, but d3-force-3d makes
  no formal guarantee.
- Very long single-cluster graphs (all memories one category, one chat) form
  one dense star ball — correct but less interesting until data diversifies.

Verification steps: `docs/second-brain-graph-verification.md`.

# Core showed only six memories (2026-07-27)

Reported from Adam's S25 Ultra: Core held around twenty saved memories but the graph only
ever showed six. Two separate causes were found; both are fixed here.

## 1. The label budget, not a node limit

Nothing ever limited how many nodes were rendered — all twenty spheres were on screen. What
was limited was how many of them were *named*.

`assets/graph/knowledge-graph.scene.js` computed its label budget as:

```js
var maxLabels = selectedKey ? 18 : zoomRatio > 0.82 ? 7 : zoomRatio > 0.5 ? 18 : 42;
```

`zoomRatio` is `cam.radius / defaultRadius`, and the camera rests at exactly `defaultRadius`
when the whole globe is framed, so the default view always took the `7` branch. A second
filter immediately below it dropped any candidate whose `nodePriority` was under 95, which
for typical importance values removed roughly one more. The result was six named nodes and a
scattering of anonymous dots, which reads as a six-memory brain.

The budget is now a function of the graph's own size (`labelBudget`), and the hard priority
cutoff is gone. The real limiter is the collision test that was already there: a label is
dropped only when it has nowhere to sit without overlapping one that is already placed. That
is an honest reason to hide a label; an arbitrary seven was not.

While changing this, label texture measurement was split out of sprite creation
(`labelInfo` / `getLabelSprite`). The old loop created a sprite for every candidate *before*
collision-testing it, so raising the budget would have added scene objects for labels that
were then discarded. Sprites are now created only once a label has actually won its place.

`graph.html` is a build artifact — `assets/graph/build.js` inlines three.js, three-forcegraph
and the scene into it. It has been regenerated, and both files are committed together. Editing
the scene without rerunning the build changes nothing on device.

## 2. Two memories sharing a key collapsed into one node

`toGraphData` keys its node map on `MemoryEntry.key` alone. `MemoryStore` only enforces
uniqueness per `(category, key)`, and the extractor generates keys as plain lower-snake-case
text with no category namespace, so the same key legitimately holds two different facts in two
different categories. When that happened the graph kept whichever had the higher importance
and silently discarded the other — a saved memory that simply did not exist in Core.

The stronger entry now keeps the plain key as its node id, and the other keeps its own node
under `key#entryId`. Extracted edges reference keys, so they stay attached to the primary; the
displaced node still joins its category cluster and still resolves to the right entry in the
detail sheet, because the sheet looks up `node.entryId`, not the id.

This reverses a previously asserted behaviour. The test
`collapses entries that share a key into one node` was rewritten rather than deleted, and now
asserts that both entries survive with distinct ids. No note or document anywhere in the repo
gives a rationale for the original collapse, and it is a data-loss path in the one surface
whose entire job is to show everything that was saved.

## State

Strict typecheck clean, Jest 47 suites / 600 tests green.

Not verified on hardware — there is still no Android toolchain on the Linux laptop (`java` is
absent from `PATH`), so no APK was built. The label arithmetic is deterministic and the second
fix is covered by a test, but the thing Adam actually needs to see is twenty labelled nodes on
the S25, and that has not happened yet.

## Deliberately left alone

`MAX_KNOWN_FACTS = 50` in `MemoryExtractor.ts` caps the existing-facts list shown to the model
for deduplication. Past fifty memories the model stops seeing older facts and will re-emit some
of them under fresh keys. `addOrUpdateEntry` catches most of that with its value-based fallback
match, so it degrades rather than breaks, but it is a real ceiling on how well Core dedupes as
it grows.

The known-issues entry in `app/CLAUDE.md` about auto-extraction being preempted is untouched.
Fixing it means changing how the single serialized LLM session arbitrates between chat and
extraction, which is not a bounded change and is not safely verifiable without a device.

# Aether Environmental Inference Study v1 — Transparent Operational Model

This is a transparent operational model, not a benchmark. No direct energy measurement
of Aether running on a physical device exists yet in this repository. Every number in
this study is either read directly from the Aether app source (model sizes, context
window, token limits) or modeled from public, cited third-party research. See
[`methodology.md`](./methodology.md) for how the two are told apart.

## What this is

A comparison of the estimated operational electricity and water impact of:

- **Local**: Aether running Gemma 4 E2B (the default "Fast" mode) on-device via LiteRT-LM,
  for three matched, representative workloads.
- **Cloud**: a generic, unnamed cloud-based LLM inference service, modeled from public
  peer-reviewed and official-source data across low/central/high scenarios.

## Headline result (generated, not hand-typed)

Every number below is produced by [`scripts/calculate-study.ts`](./scripts/calculate-study.ts)
from [`results.json`](./results.json). Re-run the script and these numbers regenerate from
the same inputs.

- **Electricity**: Estimated 91–98% lower operational electricity for the tested Short,
  Standard, and Extended workloads.
- **Water**: Modeled water-consumption range of 68–99% lower for the tested workloads —
  a wider range than electricity, because water depends on regional and infrastructure
  factors that are inherently less certain. See [`limitations.md`](./limitations.md).

Both ranges come from `results.json` → `headline_claim_eligibility` and
`water_claim_eligibility`, computed by a conservative gate (Aether at the high end of its
power-draw range vs. cloud at the low end of its energy range) through the central-scenario
result. If you change any input in [`scenario-inputs.json`](./scenario-inputs.json), these
numbers change too — that is the point.

## How to reproduce

```bash
cd website   # ts-node lives in website/node_modules
npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  ../research/environmental-inference-study-v1/scripts/calculate-study.ts
```

This regenerates `results.json`, `results.csv`, `chart-data.csv`, and everything in
`outputs/`.

## Files

| File | Purpose |
| --- | --- |
| `methodology.md` | What is measured vs. modeled, and how the model is built |
| `assumptions.md` | Every scenario input and where it comes from |
| `limitations.md` | What could change the result, in plain language |
| `references.md` | Full source list with citation keys |
| `source-manifest.json` | Machine-readable source list, one entry per citation key |
| `workload-definitions.json` | The three workloads (Short/Standard/Extended) and their token targets |
| `scenario-inputs.json` | Every numeric coefficient the model uses |
| `calculation-notes.md` | Exact formulas and unit conversions |
| `results.json` / `.csv` | Generated results — the only source of truth for published numbers |
| `scripts/calculate-study.ts` | The script that produces `results.json` from the inputs above |
| `outputs/` | CSV/JSON exports for the public data download |

## What this study does not claim

See [`limitations.md`](./limitations.md) for the full list. In short: this does not measure
a physical Aether device, does not model server-side request batching (which likely makes
real cloud energy lower than modeled here), does not compare output quality, and does not
generalize beyond the three tested workloads and the reference device assumptions stated in
`workload-definitions.json`.

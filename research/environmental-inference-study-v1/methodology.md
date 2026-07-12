# Methodology

## Study classification

This is titled **"Aether Environmental Inference Study v1 — Transparent Operational
Model,"** not a benchmark. A benchmark implies direct measurement of the thing being
described. No direct energy measurement of Aether running on a physical device exists in
this repository (see `app/src/llm/LiteRtService.ts` — the only runtime telemetry it emits
is dev-only latency/throughput logging, gated behind `__DEV__`, and it does not ship in
release builds). Every local-side number here is modeled from official or third-party
public data, clearly labeled.

## MEASURED vs. MODELED vs. SCENARIO-BASED vs. OUT OF SCOPE

- **MEASURED** — Directly measured values from Aether hardware or the repository. This
  study contains no MEASURED energy or water figures. The only directly-measured facts
  used are non-environmental: model file sizes, context window, token limits (all read
  from `app/src/models/registry.ts` and `app/src/llm/LiteRtService.ts`).
- **MODELED** — Estimated using documented inputs, formulas, and public studies:
  - Local decode throughput (52 tokens/sec) — official Google figure for the same model
    and engine Aether ships, on a reference device (see `references.md`, `google_litertlm_2026`).
  - Local incremental power draw (3–8 W) — proxy from third-party chipset power
    benchmarks, not a direct LLM-inference measurement (`chipset_power_benchmarks_2024`).
  - Cloud compute energy per token, PUE, water intensity factors — all from peer-reviewed
    or official sources (`luccioni2024`, `husom2024`, `li2023`, `uptime2024`, `aslan2018`).
- **SCENARIO-BASED** — Low / central / high bands where a variable is genuinely uncertain
  (device power draw, PUE, water intensity, network energy). See `scenario-inputs.json`
  for every band and its source.
- **OUT OF SCOPE** — Explicitly excluded from v1. See `workload-definitions.json` →
  `exclusions_for_all_workloads` and the "What this study does not claim" section of the
  public page.

## Workload-based comparison

Rather than a single "average prompt," this study defines three synthetic, transparent
workload classes — Short, Standard, Extended — with exact input/output token targets
(`workload-definitions.json`). These targets are anchored to real limits already in the
Aether codebase (e.g. `AgentKernel.ts` token caps, `ResearchEngine.ts` answer length), not
invented. A fixed system-prompt token overhead (150 tokens) is applied identically to the
local and cloud side of every workload, so the comparison stays matched. This study does
not claim output quality parity between local and cloud — quality was not tested.

## What is compared

For each workload, at each of three scenario levels (low/central/high):

**Local Aether:**
- A. Local operational electricity — decode + prefill time on Gemma 4 E2B, GPU backend,
  times an incremental-power-draw scenario.
- B. Local operational water — local electricity times a grid electricity-generation
  water-intensity factor (no data center is involved on this side).

**Cloud-based LLM inference (generic, unnamed):**
- C. Client-side electricity — phone radio active power for the duration the connection
  is open.
- D. Network electricity — data transmitted times a electricity-intensity-of-transmission
  factor.
- E. Data-center electricity — GPU compute energy per output/input token, multiplied by
  Power Usage Effectiveness (PUE) to account for cooling and facility overhead.
- F. Data-center direct water — data-center IT energy times an on-site Water Usage
  Effectiveness (WUE) factor.
- G. Electricity-generation-associated water — total facility electricity (IT energy ×
  PUE) times an off-site electricity-generation water-intensity factor (EWIF).

Water withdrawal and water consumption are never mixed: this study uses **water
consumption** figures throughout (the metric Li et al. 2023 defines and supports), stated
explicitly wherever a number appears.

## Model download

The one-time Gemma 4 E2B download (2.588 GB, exact size from `registry.ts`) is modeled as
network-transmission electricity only (no server-side inference compute — it is a static
file download, not an LLM query) and amortized across three lifetime-use scenarios: 1,000,
10,000, and 100,000 requests. It is never folded into the per-request headline number
without this amortization being shown. See `results.json` → `model_download`.

## Claim gating

A homepage or headline claim is only used if the study's own gate says it can be. The gate
requires that even the **conservative pairing** — Aether at the high end of its power-draw
range, cloud at the low end of its energy range — still shows a positive reduction for
every tested workload. If that pairing crosses zero for any workload, `headline_claim_eligible`
is `false` and no percentage is published. This gate is computed in
`scripts/calculate-study.ts`, not asserted by hand.

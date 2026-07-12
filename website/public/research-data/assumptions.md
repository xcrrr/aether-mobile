# Assumptions

Every numeric input the model uses, in one place. Each maps to a field in
`scenario-inputs.json` and a citation key in `source-manifest.json` / `references.md`.

## Workload sizing

| Workload | Input tokens (excl. system prompt) | Output tokens | Anchor |
| --- | --- | --- | --- |
| Short | 30 | 60 | Below `AgentKernel.ts` `PROPOSE_MAX_TOKENS` (220) |
| Standard | 120 | 300 | Between `runner.ts` default (256) and `ResearchEngine.ts` answer cap (640) |
| Extended | 300 | 700 | Matches `AgentKernel.ts` `ARTIFACT_MAX_TOKENS` / `refine.ts` `REVISE_MAX_TOKENS` (900) |

A fixed 150-token system-prompt overhead is added to every input count, identically for
local and cloud. This is a conservative placeholder, not a measured Aether system-prompt
length.

## Local Aether

| Assumption | Value | Source |
| --- | --- | --- |
| Model | Gemma 4 E2B ("Fast" mode, default) | `app/src/models/registry.ts` |
| Engine | LiteRT-LM, Android GPU backend (OpenCL) | `app/src/llm/engine.ts` |
| Decode speed | 52 tokens/sec | `google_litertlm_2026` (official, same model+engine) |
| Prefill speed (conservative bound) | 500 tokens/sec | Placeholder; see `limitations.md` |
| Incremental power draw | 3 W (low) / 5 W (central) / 8 W (high) | `chipset_power_benchmarks_2024` (proxy, not LLM-specific) |
| Reference device | 8 GB+ RAM Android, Snapdragon 8-series-class SoC | `app/src/models/registry.ts` `minRamGb` |

## Cloud-based LLM inference (generic, unnamed)

| Assumption | Value | Source |
| --- | --- | --- |
| Compute energy per 1,000 output tokens | 0.3 Wh (low) / 0.528 Wh (central) / 2.5 Wh (high) | `luccioni2024`, `husom2024` |
| Prefill energy discount | 50% of the output-token rate | Simplifying assumption, not independently sourced |
| Data-center PUE | 1.2 (low) / 1.56 (central) / 2.0 (high) | `uptime2024` |
| On-site cooling water (WUE) | 0.012 (low) / 1.0 (central) / 2.24 (high) L/kWh | `li2023` |
| Off-site grid water (EWIF, consumption) | 1.5 (low) / 3.1 (central) / 5.0 (high) L/kWh | `li2023` (central is the directly-cited U.S. average; low/high are this study's own band) |
| Network transmission energy | 0.03 (low) / 0.06 (central) / 0.12 (high) kWh/GB | `aslan2018` |
| Client radio active power | 0.5 (low) / 1.0 (central) / 2.0 (high) W | Informed by LTE radio power-state literature; not independently re-measured |
| Streaming display rate | 60 (low-radio-energy case) / 30 (central) / 15 (high-radio-energy case) tokens/sec | Assumption; order-of-magnitude only |

## Model download

| Assumption | Value | Source |
| --- | --- | --- |
| Gemma 4 E2B file size | 2,588,147,712 bytes (2.588 GB) | `app/src/models/registry.ts`, exact |
| Download energy | Network-transmission electricity only (same kWh/GB scenario as above) | — |
| Amortization scenarios | 1,000 / 10,000 / 100,000 lifetime requests | — |

## What is deliberately not varied

- Local model choice is fixed to Gemma 4 E2B ("Fast" mode), the app's default. "Thinking"
  mode (Gemma 4 E4B) is a larger model and would show a smaller — though this study does
  not calculate it for v1 — reduction. This is a scope choice, stated plainly rather than
  hidden.
- Output quality/capability parity between local and cloud responses is not modeled or
  claimed.

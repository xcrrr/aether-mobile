# Limitations — what this study does not claim

Stated plainly, not buried.

## No direct device measurement yet

There is no instrumented power measurement of an Aether device running LiteRT-LM in this
repository. The local electricity model combines an official Google decode-speed figure
(for the exact model and engine Aether ships) with third-party chipset power-draw
benchmarks that measured gaming and synthetic all-core workloads, not LLM inference
specifically. This is the single highest-priority gap for v2: a real Watt-meter or
`Battery Historian`-based measurement of Aether generating tokens on a physical reference
device.

## Cloud figures are single-request lab measurements

The cloud-side compute energy figures (`luccioni2024`, `husom2024`) come from controlled
experiments measuring one request at a time on a dedicated GPU. Production cloud inference
services commonly batch many concurrent requests on the same GPU, which can substantially
lower the true marginal energy cost per query below what unbatched lab measurements show.
This study does not model batching efficiency. If it were modeled, the cloud-side energy
figures — and therefore the reduction percentages in this study — would likely be smaller,
though the direction of the result (local lower than cloud) is unlikely to reverse given
how small the local device's absolute power draw is relative to data-center GPU hardware.

## Water estimates carry more uncertainty than electricity estimates

Data-center cooling design, regional grid water intensity, and seasonal variation all
affect water-consumption figures more than they affect electricity figures. The on-site
water-use-effectiveness (WUE) range used here spans roughly 190x (0.012–2.24 L/kWh) across
documented regions, versus roughly 1.7x for PUE (1.2–2.0). This is reflected in the wider
result range for water (68–99%) versus electricity (91–98%) in `results.json`.

## Single reference device, not all Android phones

The 52 tokens/sec decode figure is one official measurement on one device (a Samsung S26
Ultra). Actual on-device throughput and power draw vary by chipset generation, thermal
state, background load, and battery state. This study does not generalize to every Android
phone that meets Aether's stated 8 GB RAM minimum.

## Output quality is not compared

This study measures operational electricity and water for matched token counts. It does
not test or claim that a local Gemma 4 E2B response and a cloud response of the same length
are of comparable quality.

## Explicitly out of scope for v1

See `workload-definitions.json` → `exclusions_for_all_workloads` for the full list,
including: model training, phone and server manufacturing, device end-of-life, office and
app-development energy, non-AI app usage, screen power (identical in both conditions and
excluded from both), and network cost of optional features like Research web-fetching or
Task-mode tool calls.

## What would most improve v2

1. Direct on-device power measurement of LiteRT-LM generation on a reference Android phone.
2. A production-representative (batched) cloud serving energy figure, if one becomes
   available from a methodology-transparent public source.
3. A measured, rather than placeholder, Aether system-prompt token count.
4. Prefill-specific throughput on the Android GPU backend (only a CPU-backend figure and a
   conservative placeholder were available for this version).

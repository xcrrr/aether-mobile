# Calculation notes — exact formulas and unit conversions

All formulas below are implemented in `scripts/calculate-study.ts`. This file explains
them; the script is the source of truth.

## Unit conventions

- Electricity: watt-hours (Wh). 1 kWh = 1,000 Wh = 3,600,000 J.
- Water: milliliters (mL) for results, liters (L) for intermediate factors. 1 L = 1,000 mL.
- Data: bytes → gigabytes at 1 GB = 1e9 bytes (decimal, matching how the sourced
  kWh/GB studies define it).

## Local Aether electricity (A)

```
decode_seconds  = output_tokens / 52                      (decode_tokens_per_second)
prefill_seconds = input_tokens  / 500                      (prefill_tokens_per_second_low_bound)
total_seconds   = decode_seconds + prefill_seconds
local_wh        = (total_seconds * incremental_power_draw_watts) / 3600
```

## Local Aether water (B)

```
local_water_ml = (local_wh / 1000) * grid_ewif_l_per_kwh * 1000
```

No on-site data-center WUE term applies — there is no data center on this side of the
comparison.

## Cloud data-center compute, before overhead

```
compute_wh = (output_tokens / 1000) * energy_per_1000_output_tokens_wh
           + (input_tokens  / 1000) * energy_per_1000_output_tokens_wh * 0.5
```

The 0.5 factor discounts prefill/input tokens relative to decode/output tokens (see
`assumptions.md`).

## Cloud data-center facility electricity (E)

```
datacenter_facility_wh = compute_wh * pue
```

## Cloud network electricity (D)

```
bytes = (input_tokens + output_tokens) * 4 chars/token * 1 byte/char + 2048 (HTTP overhead)
gb    = bytes / 1e9
network_wh = gb * kwh_per_gb * 1000
```

## Cloud client-side (radio) electricity (C)

```
duration_seconds = output_tokens / streaming_tokens_per_second
client_wh = (duration_seconds * radio_active_power_watts) / 3600
```

The streaming-rate scenario is paired inversely with the radio-power scenario (low radio
power pairs with the fast/high streaming rate, and vice versa) so that each named
low/central/high scenario is internally consistent about whether it favors or disfavors the
cloud side.

## Cloud total electricity

```
cloud_total_wh = datacenter_facility_wh + network_wh + client_wh
```

## Cloud water — on-site (F) and off-site (G)

```
onsite_l  = (compute_wh / 1000) * wue_onsite_l_per_kwh
offsite_l = (datacenter_facility_wh / 1000) * grid_ewif_l_per_kwh
cloud_water_ml = (onsite_l + offsite_l) * 1000
```

On-site water scales with IT/compute energy only (cooling load tracks the compute being
cooled). Off-site water scales with total facility electricity drawn from the grid
(compute energy × PUE), because that is what the power plant actually generates. This
mirrors the formula in Li et al. 2023 (`li2023`): `Water = Σ e_t · [WUE_onsite + PUE ·
WUE_offsite]`.

## Reduction percentages

```
electricity_reduction_pct = (cloud_total_wh - local_wh) / cloud_total_wh * 100
water_reduction_pct       = (cloud_water_ml - local_water_ml) / cloud_water_ml * 100
```

## Model download amortization

```
download_wh(scenario) = (file_size_bytes / 1e9) * kwh_per_gb(scenario) * 1000
amortized_wh_per_request = download_wh(scenario) / lifetime_requests
```

Computed for 1,000 / 10,000 / 100,000 lifetime requests. Never added into the headline
per-request figure without this amortization shown alongside it.

## Sanity checks performed by the script

- Every low/central/high triple is checked for `low <= central <= high`.
- Every scenario input is checked for being a finite, non-negative number.
- Unit-conversion identities (Wh/kWh/J, L/mL) are checked at runtime, not just by
  inspection.
- `headline_claim_eligible` and `water_claim_eligible` are computed booleans, not
  hand-set flags: they require the conservative (worst-case-for-Aether) scenario pairing
  to still show a positive reduction for every workload.

## Why the network term barely matters

A short chat exchange is a few kilobytes of text, not gigabytes. Even at the high end of
the network-energy scenario band (0.12 kWh/GB), the network term contributes a fraction of
a millwatt-hour — orders of magnitude below the data-center compute term. This means the
overall result is not sensitive to exactly which network-energy study or value is chosen,
which is why a single central estimate (`aslan2018`) with a generous ±2x band was judged
sufficient rather than seeking additional sources for this term specifically.

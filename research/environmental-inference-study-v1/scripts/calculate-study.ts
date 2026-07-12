/**
 * Aether Environmental Inference Study v1 — calculation script.
 *
 * Run: npx ts-node research/environmental-inference-study-v1/scripts/calculate-study.ts
 * (from the repository root, using the ts-node already in website/node_modules)
 *
 * Produces every published number in the study. No result in the public
 * /research page or homepage is typed by hand — it is read from the JSON
 * this script writes to ../results.json.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

type Scenario = 'low' | 'central' | 'high';
const SCENARIOS: Scenario[] = ['low', 'central', 'high'];

interface Range {
  low: number;
  central: number;
  high: number;
  [k: string]: unknown;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf-8')) as T;
}

const workloadDefs = readJson<any>('workload-definitions.json');
const scenarioInputs = readJson<any>('scenario-inputs.json');
const sourceManifest = readJson<any>('source-manifest.json');

// ---------- sanity checks ----------
const sanityErrors: string[] = [];

function checkPositive(name: string, v: number) {
  if (!(v >= 0) || !Number.isFinite(v)) sanityErrors.push(`${name} is not a finite non-negative number: ${v}`);
}
function checkOrdered(name: string, r: Range) {
  if (!(r.low <= r.central && r.central <= r.high)) {
    sanityErrors.push(`${name} scenario values are not ordered low <= central <= high: ${JSON.stringify(r)}`);
  }
}

for (const key of [
  'local_incremental_power_draw_watts',
  'cloud_datacenter_energy_per_1000_output_tokens_wh',
  'datacenter_pue',
  'datacenter_onsite_wue_l_per_kwh',
  'grid_ewif_water_l_per_kwh',
  'network_transmission_energy_kwh_per_gb',
  'client_radio_active_power_watts',
]) {
  const r = scenarioInputs[key] as Range;
  checkOrdered(key, r);
  for (const s of SCENARIOS) checkPositive(`${key}.${s}`, r[s] as number);
}

// unit conversion sanity: 1 kWh === 1000 Wh === 3.6e6 J
{
  const kwh = 1;
  const wh = kwh * 1000;
  const j = wh * 3600;
  if (Math.abs(j - 3_600_000) > 1) sanityErrors.push('Wh/kWh/J conversion sanity check failed');
}
// unit conversion sanity: 1 L === 1000 mL
{
  const l = 1;
  const ml = l * 1000;
  if (ml !== 1000) sanityErrors.push('L/mL conversion sanity check failed');
}

// ---------- core model ----------

interface WorkloadTokens {
  id: string;
  label: string;
  inputTokens: number; // including shared system prompt
  outputTokens: number;
}

const SYSTEM_PROMPT_TOKENS = workloadDefs.shared_assumptions.system_prompt_tokens as number;
const CHARS_PER_TOKEN = workloadDefs.shared_assumptions.chars_per_token as number;
const BYTES_PER_CHAR = workloadDefs.shared_assumptions.bytes_per_char as number;
const HTTP_OVERHEAD_BYTES = workloadDefs.shared_assumptions.http_overhead_bytes as number;

const workloads: WorkloadTokens[] = workloadDefs.workloads.map((w: any) => ({
  id: w.id,
  label: w.label,
  inputTokens: w.input_tokens_excl_system + SYSTEM_PROMPT_TOKENS,
  outputTokens: w.output_tokens,
}));

const DECODE_TPS = workloadDefs.local_configuration.decode_tokens_per_second as number;
const PREFILL_TPS = workloadDefs.local_configuration.prefill_tokens_per_second_low_bound as number;

const STREAM_RATE = workloadDefs.cloud_configuration.streaming_display_rate_tokens_per_second as Range;

/** Local Aether: incremental electricity for one query, in Wh. */
function localElectricityWh(w: WorkloadTokens, scenario: Scenario): number {
  const decodeSeconds = w.outputTokens / DECODE_TPS;
  const prefillSeconds = w.inputTokens / PREFILL_TPS;
  const totalSeconds = decodeSeconds + prefillSeconds;
  const watts = (scenarioInputs.local_incremental_power_draw_watts as Range)[scenario] as number;
  return (totalSeconds * watts) / 3600;
}

/** Cloud data-center compute (IT) electricity before PUE, in Wh. */
function cloudComputeWh(w: WorkloadTokens, scenario: Scenario): number {
  const perThousand = (scenarioInputs.cloud_datacenter_energy_per_1000_output_tokens_wh as Range)[scenario] as number;
  const prefillDiscount = scenarioInputs.cloud_prefill_energy_discount_factor.value as number;
  const outputWh = (w.outputTokens / 1000) * perThousand;
  const inputWh = (w.inputTokens / 1000) * perThousand * prefillDiscount;
  return outputWh + inputWh;
}

/** Cloud data-center facility electricity (IT energy x PUE), in Wh. */
function cloudDatacenterFacilityWh(w: WorkloadTokens, scenario: Scenario): number {
  const pue = (scenarioInputs.datacenter_pue as Range)[scenario] as number;
  return cloudComputeWh(w, scenario) * pue;
}

/** Cloud network transmission electricity, in Wh. */
function cloudNetworkWh(w: WorkloadTokens, scenario: Scenario): number {
  const bytes = (w.inputTokens + w.outputTokens) * CHARS_PER_TOKEN * BYTES_PER_CHAR + HTTP_OVERHEAD_BYTES;
  const gb = bytes / 1e9;
  const kwhPerGb = (scenarioInputs.network_transmission_energy_kwh_per_gb as Range)[scenario] as number;
  return gb * kwhPerGb * 1000; // kWh -> Wh
}

/** Cloud client-side (phone radio) electricity, in Wh. */
function cloudClientWh(w: WorkloadTokens, scenario: Scenario): number {
  // Worse-for-cloud radio scenario pairs with worse-for-cloud streaming rate (low tok/s -> longer duration).
  const streamRateScenario: Scenario = scenario === 'low' ? 'high' : scenario === 'high' ? 'low' : 'central';
  const tokensPerSecond = STREAM_RATE[streamRateScenario] as number;
  const durationSeconds = w.outputTokens / tokensPerSecond;
  const watts = (scenarioInputs.client_radio_active_power_watts as Range)[scenario] as number;
  return (durationSeconds * watts) / 3600;
}

function cloudTotalElectricityWh(w: WorkloadTokens, scenario: Scenario) {
  const datacenter = cloudDatacenterFacilityWh(w, scenario);
  const network = cloudNetworkWh(w, scenario);
  const client = cloudClientWh(w, scenario);
  return { datacenter, network, client, total: datacenter + network + client };
}

/** Local water: grid electricity-generation water only (no data center), in mL. */
function localWaterMl(w: WorkloadTokens, scenario: Scenario): number {
  const wh = localElectricityWh(w, scenario);
  const kwh = wh / 1000;
  const ewif = (scenarioInputs.grid_ewif_water_l_per_kwh as Range)[scenario] as number;
  return kwh * ewif * 1000; // L -> mL
}

/** Cloud water: on-site (IT energy x WUE) + off-site (facility energy x EWIF), in mL. */
function cloudWaterMl(w: WorkloadTokens, scenario: Scenario) {
  const itWh = cloudComputeWh(w, scenario);
  const facilityWh = cloudDatacenterFacilityWh(w, scenario);
  const wueOnsite = (scenarioInputs.datacenter_onsite_wue_l_per_kwh as Range)[scenario] as number;
  const ewifOffsite = (scenarioInputs.grid_ewif_water_l_per_kwh as Range)[scenario] as number;
  const onsiteL = (itWh / 1000) * wueOnsite;
  const offsiteL = (facilityWh / 1000) * ewifOffsite;
  return { onsiteMl: onsiteL * 1000, offsiteMl: offsiteL * 1000, totalMl: (onsiteL + offsiteL) * 1000 };
}

// ---------- per-workload, per-scenario results ----------

const resultsByWorkload = workloads.map((w) => {
  const scenarios = SCENARIOS.map((scenario) => {
    const local = localElectricityWh(w, scenario);
    const cloud = cloudTotalElectricityWh(w, scenario);
    const localWater = localWaterMl(w, scenario);
    const cloudWater = cloudWaterMl(w, scenario);
    const electricityReductionPct = ((cloud.total - local) / cloud.total) * 100;
    const waterReductionPct = ((cloudWater.totalMl - localWater) / cloudWater.totalMl) * 100;
    return {
      scenario,
      local_electricity_wh: round(local, 6),
      cloud_electricity_wh: {
        datacenter: round(cloud.datacenter, 6),
        network: round(cloud.network, 8),
        client_radio: round(cloud.client, 6),
        total: round(cloud.total, 6),
      },
      electricity_reduction_pct: round(electricityReductionPct, 1),
      local_water_ml: round(localWater, 6),
      cloud_water_ml: {
        onsite_datacenter: round(cloudWater.onsiteMl, 6),
        offsite_grid_generation: round(cloudWater.offsiteMl, 6),
        total: round(cloudWater.totalMl, 6),
      },
      water_reduction_pct: round(waterReductionPct, 1),
    };
  });
  return {
    workload_id: w.id,
    workload_label: w.label,
    input_tokens_incl_system_prompt: w.inputTokens,
    output_tokens: w.outputTokens,
    scenarios,
  };
});

// ---------- conservative claim-gate check ----------
// Worst-case-for-Aether pairing: local uses HIGH power draw; cloud uses LOW compute/PUE/network/radio.
const conservativeGate = workloads.map((w) => {
  const local = localElectricityWh(w, 'high');
  const cloud = cloudTotalElectricityWh(w, 'low');
  const reductionPct = ((cloud.total - local) / cloud.total) * 100;
  return { workload_id: w.id, local_high_wh: round(local, 6), cloud_low_wh: round(cloud.total, 6), reduction_pct: round(reductionPct, 1) };
});

const centralPairing = workloads.map((w) => {
  const local = localElectricityWh(w, 'central');
  const cloud = cloudTotalElectricityWh(w, 'central');
  const reductionPct = ((cloud.total - local) / cloud.total) * 100;
  return { workload_id: w.id, reduction_pct: round(reductionPct, 1) };
});

const gateMin = Math.min(...conservativeGate.map((g) => g.reduction_pct));
const gateMax = Math.max(...centralPairing.map((g) => g.reduction_pct));

// Same conservative-vs-central pairing logic, applied to water.
const conservativeWaterGate = workloads.map((w) => {
  const local = localWaterMl(w, 'high');
  const cloud = cloudWaterMl(w, 'low');
  const reductionPct = ((cloud.totalMl - local) / cloud.totalMl) * 100;
  return { workload_id: w.id, local_high_ml: round(local, 6), cloud_low_ml: round(cloud.totalMl, 6), reduction_pct: round(reductionPct, 1) };
});
const centralWaterPairing = workloads.map((w) => {
  const local = localWaterMl(w, 'central');
  const cloud = cloudWaterMl(w, 'central');
  const reductionPct = ((cloud.totalMl - local) / cloud.totalMl) * 100;
  return { workload_id: w.id, reduction_pct: round(reductionPct, 1) };
});
const waterGateMin = Math.min(...conservativeWaterGate.map((g) => g.reduction_pct));
const waterGateMax = Math.max(...centralWaterPairing.map((g) => g.reduction_pct));
const waterHeadlineEligible = waterGateMin > 0 && sanityErrors.length === 0;
const waterHeadline = waterHeadlineEligible
  ? {
      water_claim_eligible: true,
      approved_water_language: `The modeled water-consumption range was ${round(waterGateMin, 0)}–${round(waterGateMax, 0)}% lower for the tested workloads, subject to infrastructure and regional assumptions (see limitations — water estimates are more uncertain than electricity estimates).`,
    }
  : { water_claim_eligible: false, approved_water_language: null };

// Eligibility per Phase 4 rules: the conservative (worst-case-for-Aether) pairing must still
// show a positive reduction for every workload — i.e. the range must not cross zero.
const headlineEligible = gateMin > 0 && sanityErrors.length === 0;

const headline = headlineEligible
  ? {
      headline_claim_eligible: true,
      reason: `Even the conservative pairing (local at the high end of its power-draw range vs. cloud at the low end of its energy range) shows a ${round(gateMin, 0)}%+ reduction across all three tested workloads; central-scenario reductions range up to ${round(gateMax, 0)}%.`,
      approved_headline_language: `Estimated ${round(gateMin, 0)}–${round(gateMax, 0)}% lower operational electricity for the tested Short, Standard, and Extended workloads (matched-workload modeled comparison; see methodology).`,
    }
  : {
      headline_claim_eligible: false,
      reason: sanityErrors.length > 0
        ? `Sanity checks failed: ${sanityErrors.join('; ')}`
        : `The conservative scenario pairing does not show a reduction for every workload (minimum: ${round(gateMin, 1)}%). The range crosses zero.`,
      approved_headline_language: null,
    };

// ---------- model-download amortization ----------
const downloadSizeBytes = scenarioInputs.model_download.size_bytes as number;
const downloadSizeGb = downloadSizeBytes / 1e9;
const downloadEnergyWhByScenario = Object.fromEntries(
  SCENARIOS.map((scenario) => {
    const kwhPerGb = (scenarioInputs.network_transmission_energy_kwh_per_gb as Range)[scenario] as number;
    return [scenario, round(downloadSizeGb * kwhPerGb * 1000, 3)];
  }),
);

const amortization = (scenarioInputs.model_download.amortization_request_counts as number[]).map((n) => ({
  lifetime_requests: n,
  amortized_download_wh_per_request: Object.fromEntries(
    SCENARIOS.map((scenario) => [scenario, round((downloadEnergyWhByScenario as any)[scenario] / n, 8)]),
  ),
}));

// ---------- assemble output ----------

const results = {
  study: 'Aether Environmental Inference Study v1 — Transparent Operational Model',
  generated_at: new Date().toISOString(),
  status: 'modeled', // measured | modeled | mixed
  sanity_checks: {
    passed: sanityErrors.length === 0,
    errors: sanityErrors,
  },
  workloads: resultsByWorkload,
  sensitivity: {
    conservative_gate_local_high_vs_cloud_low: conservativeGate,
    central_vs_central: centralPairing,
    water_conservative_gate_local_high_vs_cloud_low: conservativeWaterGate,
    water_central_vs_central: centralWaterPairing,
  },
  model_download: {
    model_id: scenarioInputs.model_download.model_id,
    size_bytes: downloadSizeBytes,
    size_gb: round(downloadSizeGb, 3),
    one_time_download_energy_wh_by_scenario: downloadEnergyWhByScenario,
    amortization,
  },
  limitations: [
    'No direct on-device energy measurement exists in the Aether repository; local electricity is modeled from official decode-speed figures combined with third-party chipset power-draw benchmarks, not a study of LLM inference specifically.',
    'Cloud energy figures come from controlled, single-request lab measurements; production cloud services likely batch concurrent requests, which could lower real-world per-query cloud energy below what is modeled here.',
    'Water estimates are more uncertain than electricity estimates: regional grid water intensity and data-center cooling design vary substantially and are only coarsely captured by the low/central/high bands used here.',
    'This study models operational inference electricity and water only. It excludes manufacturing, training, and non-AI usage — see the workload-definitions.json exclusions list.',
    'Local throughput (52 tokens/sec) is a single official figure for one reference device (Samsung S26 Ultra) and is not generalized to all Android phones that meet Aether\'s minimum RAM requirement.',
  ],
  out_of_scope: workloadDefs.exclusions_for_all_workloads,
  headline_claim_eligibility: headline,
  water_claim_eligibility: waterHeadline,
  citation_keys_used: sourceManifest.sources.map((s: any) => s.key),
};

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

fs.writeFileSync(path.join(ROOT, 'results.json'), JSON.stringify(results, null, 2));

// ---------- CSV outputs ----------
const csvRows: string[] = [
  'workload,scenario,local_electricity_wh,cloud_electricity_wh,electricity_reduction_pct,local_water_ml,cloud_water_ml,water_reduction_pct',
];
for (const w of resultsByWorkload) {
  for (const s of w.scenarios) {
    csvRows.push(
      [
        w.workload_label,
        s.scenario,
        s.local_electricity_wh,
        s.cloud_electricity_wh.total,
        s.electricity_reduction_pct,
        s.local_water_ml,
        s.cloud_water_ml.total,
        s.water_reduction_pct,
      ].join(','),
    );
  }
}
fs.writeFileSync(path.join(ROOT, 'results.csv'), csvRows.join('\n') + '\n');

const chartRows: string[] = ['workload,scenario,local_electricity_wh,cloud_electricity_wh'];
for (const w of resultsByWorkload) {
  for (const s of w.scenarios) {
    chartRows.push([w.workload_label, s.scenario, s.local_electricity_wh, s.cloud_electricity_wh.total].join(','));
  }
}
fs.writeFileSync(path.join(ROOT, 'chart-data.csv'), chartRows.join('\n') + '\n');

fs.writeFileSync(
  path.join(ROOT, 'outputs', 'summary-tables.csv'),
  csvRows.join('\n') + '\n',
);
fs.writeFileSync(
  path.join(ROOT, 'outputs', 'sensitivity-results.csv'),
  ['workload,local_high_wh,cloud_low_wh,conservative_reduction_pct']
    .concat(conservativeGate.map((g) => [g.workload_id, g.local_high_wh, g.cloud_low_wh, g.reduction_pct].join(',')))
    .join('\n') + '\n',
);
fs.writeFileSync(path.join(ROOT, 'outputs', 'generated-results.json'), JSON.stringify(results, null, 2));

// ---------- sync public downloadable package into the website ----------
const PUBLIC_DIR = path.join(ROOT, '..', '..', 'website', 'public', 'research-data');
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
for (const file of ['results.json', 'results.csv', 'chart-data.csv', 'README.md', 'methodology.md', 'assumptions.md', 'limitations.md', 'references.md', 'source-manifest.json', 'workload-definitions.json', 'scenario-inputs.json', 'calculation-notes.md']) {
  fs.copyFileSync(path.join(ROOT, file), path.join(PUBLIC_DIR, file));
}

// eslint-disable-next-line no-console
console.log(`Sanity checks: ${sanityErrors.length === 0 ? 'PASSED' : 'FAILED: ' + sanityErrors.join('; ')}`);
// eslint-disable-next-line no-console
console.log(`headline_claim_eligible: ${headline.headline_claim_eligible}`);
// eslint-disable-next-line no-console
console.log(headline.approved_headline_language ?? headline.reason);
// eslint-disable-next-line no-console
console.log('Wrote results.json, results.csv, chart-data.csv, outputs/*.csv, outputs/generated-results.json');

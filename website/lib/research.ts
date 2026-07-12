import fs from 'node:fs';
import path from 'node:path';

export interface ScenarioResult {
  scenario: 'low' | 'central' | 'high';
  local_electricity_wh: number;
  cloud_electricity_wh: { datacenter: number; network: number; client_radio: number; total: number };
  electricity_reduction_pct: number;
  local_water_ml: number;
  cloud_water_ml: { onsite_datacenter: number; offsite_grid_generation: number; total: number };
  water_reduction_pct: number;
}

export interface WorkloadResult {
  workload_id: string;
  workload_label: string;
  input_tokens_incl_system_prompt: number;
  output_tokens: number;
  scenarios: ScenarioResult[];
}

export interface StudyResults {
  study: string;
  generated_at: string;
  status: string;
  sanity_checks: { passed: boolean; errors: string[] };
  workloads: WorkloadResult[];
  sensitivity: {
    conservative_gate_local_high_vs_cloud_low: { workload_id: string; local_high_wh: number; cloud_low_wh: number; reduction_pct: number }[];
    central_vs_central: { workload_id: string; reduction_pct: number }[];
    water_conservative_gate_local_high_vs_cloud_low: { workload_id: string; local_high_ml: number; cloud_low_ml: number; reduction_pct: number }[];
    water_central_vs_central: { workload_id: string; reduction_pct: number }[];
  };
  model_download: {
    model_id: string;
    size_bytes: number;
    size_gb: number;
    one_time_download_energy_wh_by_scenario: { low: number; central: number; high: number };
    amortization: { lifetime_requests: number; amortized_download_wh_per_request: { low: number; central: number; high: number } }[];
  };
  limitations: string[];
  out_of_scope: string[];
  headline_claim_eligibility: { headline_claim_eligible: boolean; reason: string; approved_headline_language: string | null };
  water_claim_eligibility: { water_claim_eligible: boolean; approved_water_language: string | null };
  citation_keys_used: string[];
}

let cached: StudyResults | null = null;

export function getStudyResults(): StudyResults {
  if (cached) return cached;
  const file = path.join(process.cwd(), 'public', 'research-data', 'results.json');
  cached = JSON.parse(fs.readFileSync(file, 'utf-8')) as StudyResults;
  return cached;
}

export function scenarioFor(w: WorkloadResult, scenario: 'low' | 'central' | 'high'): ScenarioResult {
  const s = w.scenarios.find((s) => s.scenario === scenario);
  if (!s) throw new Error(`Missing ${scenario} scenario for ${w.workload_id}`);
  return s;
}

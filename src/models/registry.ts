import { ModelDef } from '@/types';

const HF = (variant: 'E2B' | 'E4B', filename: string) =>
  `https://huggingface.co/bartowski/google_gemma-4-${variant}-it-GGUF/resolve/main/${filename}`;

export const MODELS: ModelDef[] = [
  {
    id: 'gemma4-e2b',
    name: 'Gemma 4 E2B',
    maker: 'Google',
    description: 'Compact on-device model. Fast and reliable on 8 GB phones.',
    sizeBytes: 3462678272,
    sizeGb: 3.46,
    sizeLabel: '3.46 GB',
    minRamGb: 8,
    contextLength: 131072,
    filename: 'google_gemma-4-E2B-it-Q4_K_M.gguf',
    downloadUrl: HF('E2B', 'google_gemma-4-E2B-it-Q4_K_M.gguf'),
    color: '#4285F4',
    badge: 'Recommended',
    supportsVision: true,
    mmprojFilename: 'mmproj-google_gemma-4-E2B-it-f16.gguf',
    mmprojUrl: HF('E2B', 'mmproj-google_gemma-4-E2B-it-f16.gguf'),
    mmprojSizeBytes: 985653760,
  },
  {
    id: 'gemma4-e4b',
    name: 'Gemma 4 E4B',
    maker: 'Google',
    description: 'Most capable. Needs RAM headroom — best on higher-end devices.',
    sizeBytes: 5405168384,
    sizeGb: 5.41,
    sizeLabel: '5.41 GB',
    minRamGb: 8,
    contextLength: 131072,
    filename: 'google_gemma-4-E4B-it-Q4_K_M.gguf',
    downloadUrl: HF('E4B', 'google_gemma-4-E4B-it-Q4_K_M.gguf'),
    color: '#7C3AED',
    badge: 'Most capable',
    supportsVision: true,
    mmprojFilename: 'mmproj-google_gemma-4-E4B-it-f16.gguf',
    mmprojUrl: HF('E4B', 'mmproj-google_gemma-4-E4B-it-f16.gguf'),
    mmprojSizeBytes: 990372352,
  },
];

export const DEFAULT_MODEL_ID = 'gemma4-e2b';

export const getModelById = (id: string): ModelDef | undefined =>
  MODELS.find((m) => m.id === id);

// Two response "modes" surfaced in the chat header, each backed by a real model.
export interface ModeDef {
  id: 'fast' | 'thinking';
  label: string;
  modelId: string;
  desc: string;
}

export const MODES: ModeDef[] = [
  { id: 'fast', label: 'Fast', modelId: 'gemma4-e2b', desc: 'Quick replies, light on memory.' },
  { id: 'thinking', label: 'Thinking', modelId: 'gemma4-e4b', desc: 'Deeper reasoning, more capable.' },
];

export const modeForModel = (modelId: string | undefined): ModeDef =>
  MODES.find((m) => m.modelId === modelId) ?? MODES[0];

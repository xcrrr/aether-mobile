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
    sizeLabel: '3.46 GB',
    minRamGb: 8,
    contextLength: 131072,
    filename: 'google_gemma-4-E2B-it-Q4_K_M.gguf',
    downloadUrl: HF('E2B', 'google_gemma-4-E2B-it-Q4_K_M.gguf'),
    color: '#4285F4',
    badge: 'Recommended',
  },
  {
    id: 'gemma4-e4b',
    name: 'Gemma 4 E4B',
    maker: 'Google',
    description: 'Most capable. Needs RAM headroom — best on higher-end devices.',
    sizeBytes: 5405168384,
    sizeLabel: '5.41 GB',
    minRamGb: 8,
    contextLength: 131072,
    filename: 'google_gemma-4-E4B-it-Q4_K_M.gguf',
    downloadUrl: HF('E4B', 'google_gemma-4-E4B-it-Q4_K_M.gguf'),
    color: '#7C3AED',
    badge: 'Most capable',
  },
];

export const DEFAULT_MODEL_ID = 'gemma4-e2b';

export const getModelById = (id: string): ModelDef | undefined =>
  MODELS.find((m) => m.id === id);

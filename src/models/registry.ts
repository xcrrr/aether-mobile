import { ModelDef } from '@/types';

// LiteRT-LM `.litertlm` bundles — the exact engine + models Google's AI Edge
// Gallery runs. Multimodal in ONE file (vision built in, no separate pack).
// Ungated public mirror — no HuggingFace auth needed.
const HF = (variant: 'E2B' | 'E4B', filename: string) =>
  `https://huggingface.co/litert-community/gemma-4-${variant}-it-litert-lm/resolve/main/${filename}`;

export const MODELS: ModelDef[] = [
  {
    id: 'gemma4-e2b',
    name: 'Gemma 4 E2B',
    maker: 'Google',
    description: 'Compact, GPU-accelerated. Fast and reliable on 8 GB phones. Sees images.',
    sizeBytes: 2588147712,
    sizeGb: 2.59,
    sizeLabel: '2.6 GB',
    minRamGb: 8,
    contextLength: 4096,
    filename: 'gemma-4-E2B-it.litertlm',
    downloadUrl: HF('E2B', 'gemma-4-E2B-it.litertlm'),
    color: '#4285F4',
    badge: 'Recommended',
    supportsVision: true,
  },
  {
    id: 'gemma4-e4b',
    name: 'Gemma 4 E4B',
    maker: 'Google',
    description: 'Most capable. GPU-accelerated, sees images. Best on higher-end devices.',
    sizeBytes: 3659530240,
    sizeGb: 3.66,
    sizeLabel: '3.7 GB',
    minRamGb: 8,
    contextLength: 4096,
    filename: 'gemma-4-E4B-it.litertlm',
    downloadUrl: HF('E4B', 'gemma-4-E4B-it.litertlm'),
    color: '#7C3AED',
    badge: 'Most capable',
    supportsVision: true,
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

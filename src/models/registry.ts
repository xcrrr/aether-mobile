import { ModelDef } from '@/types';

// LiteRT `.task` bundles (MediaPipe GenAI). Multimodal in ONE file — vision is
// built in, so there is NO separate "vision pack" download. Ungated public
// mirror (no HuggingFace auth needed), same Gemma 4 models as before.
const HF = (variant: 'E2B' | 'E4B', filename: string) =>
  `https://huggingface.co/litert-community/gemma-4-${variant}-it-litert-lm/resolve/main/${filename}`;

export const MODELS: ModelDef[] = [
  {
    id: 'gemma4-e2b',
    name: 'Gemma 4 E2B',
    maker: 'Google',
    description: 'Compact, GPU-accelerated. Fast and reliable on 8 GB phones. Sees images.',
    sizeBytes: 2003697664,
    sizeGb: 2.0,
    sizeLabel: '2.0 GB',
    minRamGb: 8,
    contextLength: 4096,
    filename: 'gemma-4-E2B-it-web.task',
    downloadUrl: HF('E2B', 'gemma-4-E2B-it-web.task'),
    color: '#4285F4',
    badge: 'Recommended',
    supportsVision: true,
  },
  {
    id: 'gemma4-e4b',
    name: 'Gemma 4 E4B',
    maker: 'Google',
    description: 'Most capable. GPU-accelerated, sees images. Best on higher-end devices.',
    sizeBytes: 2964324352,
    sizeGb: 2.96,
    sizeLabel: '3.0 GB',
    minRamGb: 8,
    contextLength: 4096,
    filename: 'gemma-4-E4B-it-web.task',
    downloadUrl: HF('E4B', 'gemma-4-E4B-it-web.task'),
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

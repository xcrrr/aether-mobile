/**
 * The active on-device inference engine.
 *
 * Aether runs on Google's MediaPipe LiteRT GenAI engine (GPU-accelerated,
 * `.litertlm` models, Gemma vision built in). This module is the single seam
 * the rest of the app imports from. LiteRT is the only active engine.
 */
export * from './LiteRtService';

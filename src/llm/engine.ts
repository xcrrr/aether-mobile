/**
 * The active on-device inference engine.
 *
 * Aether runs on Google's MediaPipe LiteRT GenAI engine (GPU-accelerated, `.task`
 * models, Gemma vision built in). This module is the single seam the rest of the
 * app imports from — swap the re-export to change engines without touching callers.
 */
export * from './LiteRtService';

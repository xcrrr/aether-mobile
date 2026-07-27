import { MemoryEntry } from './types';

export interface CoreSendSnapshot {
  enabled: boolean;
  entries: MemoryEntry[];
  consentToken?: string;
}

interface CoreSendSource {
  ensureHydrated: () => Promise<void>;
  hasHydrated: () => boolean;
  isEnabled: () => boolean;
  getAllEntries: () => MemoryEntry[];
  extractionConsentToken: () => string;
}

/**
 * Capture one immutable Core decision for a chat send.
 *
 * A cold start must first honor the persisted setting. Once hydration has
 * completed, every value is read synchronously so a toggle during later chat
 * persistence or prompt construction cannot change consent for this reply.
 */
export async function captureCoreSendSnapshot(source: CoreSendSource): Promise<CoreSendSnapshot> {
  if (!source.hasHydrated()) await source.ensureHydrated();

  const enabled = source.isEnabled();
  return {
    enabled,
    entries: enabled ? [...source.getAllEntries()] : [],
    ...(enabled ? { consentToken: source.extractionConsentToken() } : {}),
  };
}

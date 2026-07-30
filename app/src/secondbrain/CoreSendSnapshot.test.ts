import { captureCoreSendSnapshot } from './CoreSendSnapshot';
import { MemoryEntry } from './types';

const note: MemoryEntry = {
  id: 'note-1',
  category: 'goals',
  key: 'training_goal',
  value: 'Training for a long-distance race',
  confidence: 0.9,
  sourceConversationId: 'conversation-1',
  createdAt: 1,
  updatedAt: 1,
  lastSeenAt: 1,
  timesReinforced: 0,
};

function source(state: { hydrated: boolean; enabled: boolean }) {
  let finishHydration: (() => void) | undefined;
  return {
    state,
    api: {
      hasHydrated: () => state.hydrated,
      ensureHydrated: () => new Promise<void>((resolve) => { finishHydration = resolve; }),
      isEnabled: () => state.enabled,
      getAllEntries: () => [note],
      extractionConsentToken: () => 'enabled-session',
    },
    finishHydration: () => finishHydration?.(),
  };
}

describe('Core send snapshot', () => {
  it('waits for cold hydration and honors a persisted disabled setting', async () => {
    const core = source({ hydrated: false, enabled: true });
    const pending = captureCoreSendSnapshot(core.api);

    core.state.enabled = false;
    core.state.hydrated = true;
    core.finishHydration();

    await expect(pending).resolves.toEqual({ enabled: false, entries: [] });
  });

  it('keeps a reply that started disabled free of recall across a rapid re-enable', async () => {
    const core = source({ hydrated: true, enabled: false });
    const disabledReply = captureCoreSendSnapshot(core.api);
    core.state.enabled = true;

    await expect(disabledReply).resolves.toEqual({ enabled: false, entries: [] });
    await expect(captureCoreSendSnapshot(core.api)).resolves.toEqual({
      enabled: true,
      entries: [note],
      consentToken: 'enabled-session',
    });
  });

  it('fails closed when hydration finishes without becoming ready', async () => {
    const core = source({ hydrated: false, enabled: true });
    const pending = captureCoreSendSnapshot(core.api);
    core.finishHydration();

    await expect(pending).resolves.toEqual({ enabled: false, entries: [] });
  });
});

import { fireEvent, render } from '@testing-library/react-native';
import { MemoryEditModal } from './MemoryEditModal';
import { useMemoryStore } from '@/secondbrain/MemoryStore';
import { MemoryEntry } from '@/secondbrain/types';

jest.mock('@/theme/useColors', () => {
  const { darkColors } = require('@/theme');
  return { useColors: () => darkColors };
});

const entry: MemoryEntry = {
  id: 'memory-1',
  category: 'goals',
  key: 'race_schedule',
  value: 'Race training happens on Tuesdays',
  confidence: 0.85,
  sourceConversationId: 'training-chat',
  evidence: 'I train for the race on Tuesdays',
  createdAt: 1,
  updatedAt: 1,
  lastSeenAt: 1,
  timesReinforced: 1,
};

describe('MemoryEditModal', () => {
  beforeEach(() => {
    useMemoryStore.setState((state) => ({
      memory: {
        ...state.memory,
        entries: [entry],
        edges: [],
        deletions: [],
      },
    }));
  });

  it('keeps an invalid correction open, then persists a valid trimmed correction', () => {
    const onClose = jest.fn();
    const screen = render(<MemoryEditModal entry={entry} onClose={onClose} />);

    fireEvent.changeText(screen.getByLabelText('Memory value'), '   ');
    const disabledSave = screen.getByLabelText('Save memory');
    fireEvent.press(disabledSave, { stopPropagation: jest.fn() });

    expect(onClose).not.toHaveBeenCalled();
    expect(useMemoryStore.getState().memory.entries[0].value).toBe(entry.value);

    fireEvent.changeText(screen.getByLabelText('Memory value'), '  Race training moved to Fridays  ');
    fireEvent.press(screen.getByLabelText('Save memory'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useMemoryStore.getState().memory.entries[0]).toMatchObject({
      value: 'Race training moved to Fridays',
      confidence: 1,
      sourceConversationId: 'manual',
      evidence: undefined,
      reason: 'You corrected this Core note',
    });
  });
});

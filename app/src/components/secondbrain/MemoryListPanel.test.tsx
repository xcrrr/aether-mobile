import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Animated } from 'react-native';
import { MemoryListPanel } from './MemoryListPanel';
import { useMemoryStore } from '@/secondbrain/MemoryStore';
import { MemoryEntry } from '@/secondbrain/types';

jest.mock('@/theme/useColors', () => {
  const { darkColors } = require('@/theme');
  return { useColors: () => darkColors };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const entry: MemoryEntry = {
  id: 'memory-1',
  category: 'preferences',
  key: 'response_style',
  value: 'Keep answers concise',
  confidence: 1,
  sourceConversationId: 'manual',
  createdAt: 1,
  updatedAt: 1,
  lastSeenAt: 1,
  timesReinforced: 0,
};

describe('MemoryListPanel', () => {
  beforeEach(() => {
    jest.spyOn(Animated, 'timing').mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    } as ReturnType<typeof Animated.timing>);
    useMemoryStore.setState((state) => ({
      memory: {
        ...state.memory,
        entries: [entry],
        edges: [],
        deletions: [],
        lastExtractionAt: 0,
        totalConversationsAnalyzed: 0,
      },
      enabled: true,
      recentKeys: [],
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps a list memory until its destructive confirmation is accepted', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(
      <MemoryListPanel open onClose={jest.fn()} onOpenEntry={jest.fn()} />,
    );

    fireEvent.press(
      screen.getByLabelText('Delete response style'),
      { stopPropagation: jest.fn() },
    );

    expect(useMemoryStore.getState().memory.entries).toEqual([entry]);
    expect(alert).toHaveBeenCalledWith(
      'Delete this memory?',
      '"Keep answers concise" will be removed from Core, along with its connections.',
      expect.any(Array),
    );

    const actions = alert.mock.calls[0][2]!;
    actions.find((action) => action.text === 'Cancel')?.onPress?.();
    expect(useMemoryStore.getState().memory.entries).toEqual([entry]);

    act(() => {
      actions.find((action) => action.text === 'Delete')?.onPress?.();
    });
    expect(useMemoryStore.getState().memory.entries).toEqual([]);
  });

  it('updates an existing fact when manual input uses a human-readable key variant', () => {
    useMemoryStore.setState((state) => ({
      memory: {
        ...state.memory,
        entries: [{ ...entry, category: 'context' }],
      },
    }));
    const screen = render(
      <MemoryListPanel open onClose={jest.fn()} onOpenEntry={jest.fn()} />,
    );

    fireEvent.press(screen.getByText('Add fact'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. favorite_color'), ' Response Style ');
    fireEvent.changeText(screen.getByPlaceholderText('The fact to remember...'), 'Use detailed answers');
    fireEvent.press(screen.getByText('Add'));

    expect(useMemoryStore.getState().memory.entries).toHaveLength(1);
    expect(useMemoryStore.getState().memory.entries[0]).toMatchObject({
      category: 'context',
      key: 'response_style',
      value: 'Use detailed answers',
      confidence: 1,
      sourceConversationId: 'manual',
    });
  });

  it('removes a selected category filter when that category no longer exists', async () => {
    const goalEntry: MemoryEntry = {
      ...entry,
      id: 'memory-2',
      category: 'goals',
      key: 'current_goal',
      value: 'Ship the beta',
    };
    useMemoryStore.setState((state) => ({
      memory: {
        ...state.memory,
        entries: [entry, goalEntry],
      },
    }));
    const screen = render(
      <MemoryListPanel open onClose={jest.fn()} onOpenEntry={jest.fn()} />,
    );

    fireEvent.press(screen.getAllByText('preferences')[0]);
    expect(screen.queryByText('Ship the beta')).toBeNull();

    act(() => {
      useMemoryStore.setState((state) => ({
        memory: {
          ...state.memory,
          entries: [goalEntry],
        },
      }));
    });

    await waitFor(() => expect(screen.getByText('Ship the beta')).toBeTruthy());
    expect(screen.queryByText('No entries match your search.')).toBeNull();
  });
});

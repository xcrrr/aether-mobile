import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode, Ref } from 'react';
import { BackHandler } from 'react-native';
import { router } from 'expo-router';
import SecondBrainScreen from './SecondBrainScreen';
import { useMemoryStore } from '@/secondbrain/MemoryStore';
import { MemoryEntry } from '@/secondbrain/types';
import { useChatStore } from '@/state/useChatStore';

interface MockGraphProps {
  data: { nodes: { id: string }[] };
  onNodeTap: (key: string) => void;
}

let mockGraphProps: MockGraphProps | null = null;

jest.mock('@/theme/useColors', () => {
  const { darkColors } = require('@/theme');
  return { useColors: () => darkColors };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/components/secondbrain/MemoryGraphView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    MemoryGraphView: React.forwardRef((props: MockGraphProps, ref: Ref<unknown>) => {
      mockGraphProps = props;
      React.useImperativeHandle(ref, () => ({ resetView: jest.fn() }));
      return React.createElement(View, { testID: 'memory-graph' });
    }),
  };
});

jest.mock('@/components/secondbrain/GraphErrorBoundary', () => ({
  GraphErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@/components/secondbrain/MemoryListPanel', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MemoryListPanel: ({ open }: { open: boolean }) => (
      open ? React.createElement(Text, null, 'Memory drawer open') : null
    ),
  };
});

jest.mock('@/components/secondbrain/MemoryEditModal', () => ({
  MemoryEditModal: () => null,
}));

function memory(index: number, sourceConversationId = 'manual'): MemoryEntry {
  return {
    id: `memory-id-${index}`,
    category: 'context',
    key: `memory_${index}`,
    value: `Memory number ${index}`,
    confidence: 1,
    sourceConversationId,
    createdAt: index + 1,
    updatedAt: index + 1,
    lastSeenAt: index + 1,
    timesReinforced: 0,
  };
}

function setMemories(entries: MemoryEntry[]) {
  useMemoryStore.setState((state) => ({
    memory: {
      ...state.memory,
      entries,
      edges: [],
      deletions: [],
      lastExtractionAt: 0,
      totalConversationsAnalyzed: 0,
    },
    recentKeys: [],
  }));
}

describe('SecondBrainScreen', () => {
  beforeEach(() => {
    mockGraphProps = null;
    jest.clearAllMocks();
    setMemories([]);
    useChatStore.setState({ index: [], current: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows every memory in graph search instead of truncating the results', () => {
    setMemories(Array.from({ length: 45 }, (_, index) => memory(index)));
    const screen = render(<SecondBrainScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Search memories' }));

    expect(screen.getAllByText(/^Memory number \d+$/)).toHaveLength(45);
  });

  it('closes the memory drawer on Android Back before leaving Core', () => {
    let hardwareBack: (() => boolean | null | undefined) | null = null;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      hardwareBack = handler;
      return { remove: jest.fn() };
    });
    const screen = render(<SecondBrainScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'View all memories' }));
    expect(screen.getByText('Memory drawer open')).toBeTruthy();

    let handled = false;
    act(() => {
      handled = hardwareBack?.() ?? false;
    });

    expect(handled).toBe(true);
    expect(screen.queryByText('Memory drawer open')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('only offers and opens a source while its conversation still exists', () => {
    setMemories([memory(1, 'source-chat')]);
    const screen = render(<SecondBrainScreen />);

    act(() => {
      mockGraphProps?.onNodeTap('memory_1');
    });
    expect(screen.getByText(/From a deleted chat/)).toBeTruthy();
    expect(screen.queryByText('Open source')).toBeNull();

    act(() => {
      useChatStore.setState({
        index: [{
          id: 'source-chat',
          title: 'Source conversation',
          modelId: 'model',
          createdAt: 1,
          updatedAt: 1,
          preview: '',
        }],
      });
    });

    fireEvent.press(screen.getByText('Open source'));
    expect(router.push).toHaveBeenCalledWith('/(main)/chat/source-chat');
  });
});

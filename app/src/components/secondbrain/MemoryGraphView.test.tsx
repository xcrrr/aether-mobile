import { act, render, waitFor } from '@testing-library/react-native';
import type { Ref } from 'react';
import { MemoryGraphView } from './MemoryGraphView';
import { GraphData } from './graphData';

interface MockWebViewProps {
  onMessage: (event: unknown) => void;
}

let mockWebViewProps: MockWebViewProps | null = null;

jest.mock('../../../assets/graph/graph.html', () => 1);

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      localUri: 'file:///graph.html',
      uri: 'file:///graph.html',
      downloadAsync: jest.fn(async () => undefined),
    })),
  },
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(async () => '<html></html>'),
}));

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: React.forwardRef((props: MockWebViewProps, ref: Ref<unknown>) => {
      mockWebViewProps = props;
      React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
      return React.createElement(View, { testID: 'graph-webview' });
    }),
  };
});

const EMPTY_GRAPH: GraphData = {
  nodes: [],
  links: [],
  layout: {
    radius: 8,
    clusterCenters: {},
  },
};

describe('MemoryGraphView', () => {
  beforeEach(() => {
    mockWebViewProps = null;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('recovers when the graph reports ready after the startup timeout', async () => {
    const screen = render(
      <MemoryGraphView
        data={EMPTY_GRAPH}
        onNodeTap={jest.fn()}
        onClearFocus={jest.fn()}
        focusKey={null}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('graph-webview')).toBeTruthy());

    act(() => {
      jest.advanceTimersByTime(12000);
    });
    expect(screen.getByText('Graph unavailable')).toBeTruthy();
    expect(screen.getByText('The graph could not start on this device.')).toBeTruthy();

    act(() => {
      mockWebViewProps?.onMessage({
        nativeEvent: { data: JSON.stringify({ type: 'ready' }) },
      });
    });

    expect(screen.queryByText('Graph unavailable')).toBeNull();
    expect(screen.queryByText('The graph could not start on this device.')).toBeNull();
    expect(screen.getByText('Core will grow as Aether learns what matters to you.')).toBeTruthy();
  });
});

import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { GraphData } from './graphData';
import { colors } from '@/theme';

interface Props { data: GraphData; onNodeTap: (key: string) => void; focusKey?: string | null; }

export function Graph3D({ data, onNodeTap, focusKey }: Props) {
  const ref = useRef<WebView>(null);
  const [uri, setUri] = useState<string | null>(null);

  // Resolve the bundled self-contained HTML to a local file:// uri (offline).
  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(require('../../../assets/graph/graph.html'));
      await asset.downloadAsync();
      setUri(asset.localUri ?? asset.uri);
    })();
  }, []);

  // Push data whenever it changes (and once the page signals ready).
  const payload = JSON.stringify(data);
  useEffect(() => {
    ref.current?.injectJavaScript(
      `window.__setGraphData && window.__setGraphData(${JSON.stringify(payload)}); true;`,
    );
  }, [payload]);

  // Fly the camera to a node when the screen asks to focus one (e.g. list tap).
  useEffect(() => {
    if (focusKey) {
      ref.current?.injectJavaScript(
        `window.__focusNode && window.__focusNode(${JSON.stringify(focusKey)}); true;`,
      );
    }
  }, [focusKey]);

  if (!uri) return <View style={styles.fill} />;

  return (
    <View style={styles.fill}>
      <WebView
        ref={ref}
        source={{ uri }}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        domStorageEnabled
        // WebGL (three.js) needs a GPU-backed surface — without an explicit hardware
        // layer the canvas renders blank/black inside a nested ScrollView on Android.
        androidLayerType="hardware"
        // Let the 3D canvas own its drag gestures inside the parent ScrollView.
        nestedScrollEnabled
        // The graph is offline self-contained; never let it fall back to a network spinner.
        cacheEnabled={false}
        // Recover from a crashed renderer (large WebGL scenes can OOM the web process).
        onRenderProcessGone={() => ref.current?.reload()}
        onError={(e) => console.warn('[Graph3D] webview error', e.nativeEvent)}
        onHttpError={(e) => console.warn('[Graph3D] webview http error', e.nativeEvent)}
        style={styles.fill}
        containerStyle={{ backgroundColor: colors.bg }}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === 'ready') {
              ref.current?.injectJavaScript(
                `window.__setGraphData(${JSON.stringify(payload)}); true;`,
              );
            } else if (msg.type === 'nodeTap' && typeof msg.key === 'string') {
              onNodeTap(msg.key);
            }
          } catch { /* ignore non-JSON */ }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.bg } });

import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { GraphData } from './graphData';
import { colors } from '@/theme';

interface Props { data: GraphData; onNodeTap: (key: string) => void; }

export function Graph3D({ data, onNodeTap }: Props) {
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

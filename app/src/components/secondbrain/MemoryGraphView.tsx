import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { GraphData } from '@/components/secondbrain/graphData';
import { fonts, fontSize, spacing } from '@/theme';

const GRAPH_BG = '#181818';
const GRAPH_TEXT = 'rgba(246,242,250,0.92)';
const GRAPH_MUTED = 'rgba(210,205,216,0.58)';
const GRAPH_ACCENT = '#9A87C6';

let htmlPromise: Promise<string> | null = null;
function loadGraphHtml(): Promise<string> {
  if (!htmlPromise) {
    htmlPromise = (async () => {
      const htmlModule = require('../../../assets/graph/graph.html');
      const asset = Asset.fromModule(htmlModule);
      await asset.downloadAsync();
      return FileSystem.readAsStringAsync(asset.localUri ?? asset.uri);
    })();
  }
  return htmlPromise;
}

interface Props {
  data: GraphData;
  onNodeTap: (key: string) => void;
  onClearFocus: () => void;
  focusKey: string | null;
  /** Screen bands (px) covered by the header / status overlays, so the camera
   *  auto-fit frames the globe inside the actually visible area. */
  overlayTop?: number;
  overlayBottom?: number;
}

export function MemoryGraphView({ data, onNodeTap, onClearFocus, focusKey, overlayTop = 0, overlayBottom = 0 }: Props) {
  const webRef = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGraphHtml()
      .then((h) => alive && setHtml(h))
      .catch((e) => alive && setError(`asset: ${e?.message ?? e}`));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!html || ready || error) return;
    const id = setTimeout(() => setError('The graph could not start on this device.'), 12000);
    return () => clearTimeout(id);
  }, [html, ready, error]);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(
      `window.__setViewportPadding && window.__setViewportPadding(${Math.round(overlayTop)}, ${Math.round(overlayBottom)}); true;`,
    );
  }, [ready, overlayTop, overlayBottom]);

  useEffect(() => {
    if (!ready) return;
    const payload = JSON.stringify(JSON.stringify(data));
    webRef.current?.injectJavaScript(`window.__setGraphData && window.__setGraphData(${payload}); true;`);
  }, [ready, data]);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.__setReducedMotion && window.__setReducedMotion(${reduceMotion ? 'true' : 'false'}); true;`);
  }, [ready, reduceMotion]);

  useEffect(() => {
    if (!ready) return;
    if (focusKey) {
      const key = JSON.stringify(focusKey);
      webRef.current?.injectJavaScript(`window.__focusNode && window.__focusNode(${key}); true;`);
    } else {
      webRef.current?.injectJavaScript('window.__clearFocus && window.__clearFocus(); true;');
    }
  }, [ready, focusKey]);

  useFocusEffect(
    useCallback(() => {
      webRef.current?.injectJavaScript('window.__setPaused && window.__setPaused(false); true;');
      return () => {
        webRef.current?.injectJavaScript('window.__setPaused && window.__setPaused(true); true;');
      };
    }, []),
  );

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'nodeTap' && msg.key) onNodeTap(msg.key);
      else if (msg.type === 'clearFocus') onClearFocus();
      else if (msg.type === 'error') setError(String(msg.error ?? 'scene error'));
    } catch {
      /* ignore malformed bridge messages */
    }
  }, [onClearFocus, onNodeTap]);

  const isEmpty = data.nodes.length === 0;

  return (
    <View style={styles.fill}>
      {html && (
        <WebView
          ref={webRef}
          source={{ html }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          onError={(e) => setError(`webview: ${e.nativeEvent.description}`)}
          onRenderProcessGone={() => setError('The graph renderer crashed.')}
          style={styles.web}
          containerStyle={styles.web}
          androidLayerType="hardware"
          scrollEnabled={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
        />
      )}

      {!error && (!html || !ready) && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={GRAPH_ACCENT} />
          <Text style={styles.loadingText}>Preparing your map...</Text>
        </View>
      )}

      {error && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.emptyTitle}>Graph unavailable</Text>
          <Text style={styles.emptyHint}>{error}</Text>
        </View>
      )}

      {!error && ready && isEmpty && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.emptyTitle}>Your Second Brain will grow as Aether learns what matters to you.</Text>
          <Text style={styles.emptyHint}>Useful memories, projects, people, and ideas will appear here as connected context.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: GRAPH_BG },
  web: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  loadingText: { color: GRAPH_MUTED, fontSize: fontSize.sm2, fontFamily: fonts.sans, letterSpacing: 0 },
  emptyTitle: { color: GRAPH_TEXT, fontSize: fontSize.lg, fontFamily: fonts.display, textAlign: 'center', lineHeight: 24 },
  emptyHint: { color: GRAPH_MUTED, fontSize: fontSize.sm2, fontFamily: fonts.sans, textAlign: 'center', lineHeight: 19, maxWidth: 310 },
});

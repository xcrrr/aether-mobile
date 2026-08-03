import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { GraphData } from '@/components/secondbrain/graphData';
import { fonts, fontSize, spacing, Palette } from '@/theme';
import { useColors, useIsDark } from '@/theme/useColors';

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

export interface MemoryGraphViewHandle {
  /** Clear focus and return the camera to the default whole-globe framing. */
  resetView(): void;
}

export const MemoryGraphView = forwardRef<MemoryGraphViewHandle, Props>(function MemoryGraphView(
  { data, onNodeTap, onClearFocus, focusKey, overlayTop = 0, overlayBottom = 0 }: Props,
  ref,
) {
  const c = useColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(c), [c]);
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

  // Hand the scene the app's palette. Without this the WebView renders its own
  // hardcoded dark theme, which on the warm-paper theme is a black rectangle in
  // the middle of a light screen.
  useEffect(() => {
    if (!ready) return;
    const theme = JSON.stringify({ bg: c.bg, text: c.text, accent: c.violet, light: !isDark });
    webRef.current?.injectJavaScript(`window.__setTheme && window.__setTheme(${theme}); true;`);
  }, [ready, c, isDark]);

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

  useImperativeHandle(ref, () => ({
    resetView() {
      webRef.current?.injectJavaScript('window.__resetView && window.__resetView(); true;');
    },
  }), []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') {
        setError(null);
        setReady(true);
      }
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
          injectedJavaScriptBeforeContentLoaded={
            `window.__initialTheme = ${JSON.stringify({ bg: c.bg, text: c.text, accent: c.violet, light: !isDark })}; true;`
          }
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
          <ActivityIndicator size="large" color={c.violet} />
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
          <Text style={styles.emptyTitle}>Core will grow as Aether learns what matters to you.</Text>
          <Text style={styles.emptyHint}>Useful memories, projects, people, and ideas will appear here as connected context.</Text>
        </View>
      )}
    </View>
  );
});

const makeStyles = (c: Palette) => StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.bg },
  web: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  loadingText: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sans, letterSpacing: 0 },
  emptyTitle: { color: c.text, fontSize: fontSize.lg, fontFamily: fonts.display, textAlign: 'center', lineHeight: 24 },
  emptyHint: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sans, textAlign: 'center', lineHeight: 19, maxWidth: 310 },
});

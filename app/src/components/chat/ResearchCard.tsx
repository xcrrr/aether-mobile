import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Linking, StyleSheet, Text, View } from 'react-native';
import { Check, Globe, Minus } from 'lucide-react-native';
import { PressableScale } from '@/components/ds/PressableScale';
import { useResearchStore } from '@/state/useResearchStore';
import { parseUrl } from '@/webresearch/safety';
import { ProgressSource, ResearchProgress } from '@/webresearch/types';
import { Message } from '@/types';
import { radius, spacing, fonts, fontSize, typography, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

/** `example.com` from a URL — the part a reader actually uses to judge a source. */
export function domainOf(url: string): string {
  const host = parseUrl(url)?.host ?? '';
  return host.replace(/^www\./, '') || url;
}

function phaseLabel(p: ResearchProgress): string {
  if (p.phase === 'searching') return 'Searching the web';
  if (p.phase === 'reading') {
    return p.read > 0 ? `Read ${p.read} of ${p.target} sources` : 'Opening sources';
  }
  if (p.phase === 'writing') return `Writing from ${p.target} source${p.target === 1 ? '' : 's'}`;
  return 'Done';
}

/** Slow breathing dot: the one moving thing while a source is being read. */
function ReadingDot({ color }: { color: string }) {
  const a = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.35, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: a }} />;
}

function SourceState({ state }: { state: ProgressSource['state'] }) {
  const c = useColors();
  if (state === 'read') return <Check size={13} color={c.violet} strokeWidth={2.4} />;
  if (state === 'failed') return <Minus size={13} color={c.textMuted} strokeWidth={2.4} />;
  return <ReadingDot color={c.violet} />;
}

/**
 * Research in flight. Replaces the old approach of writing `_Reading sources
 * 2/3_` into the message body: the user now sees which pages are being opened,
 * which succeeded, and which were unreachable.
 */
export function ResearchLiveCard() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const progress = useResearchStore((s) => s.progress);
  if (!progress) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Globe size={14} color={c.violet} strokeWidth={2} />
        <Text style={styles.headText}>{phaseLabel(progress)}</Text>
      </View>

      {progress.searchedQuery ? (
        <Text style={styles.searched} numberOfLines={2}>{progress.searchedQuery}</Text>
      ) : null}

      {progress.sources.map((s) => (
        <View key={s.url} style={styles.liveRow}>
          <View style={styles.stateCol}><SourceState state={s.state} /></View>
          <View style={styles.rowText}>
            <Text
              style={[styles.domain, s.state === 'failed' && styles.dim]}
              numberOfLines={1}
            >
              {domainOf(s.url)}
            </Text>
            {!!s.title && (
              <Text style={[styles.title, s.state === 'failed' && styles.dim]} numberOfLines={1}>
                {s.state === 'failed' ? "couldn't be opened" : s.title}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The sources behind a finished answer. Numbers line up with the inline [n]
 * markers in the answer text, so a reader can follow any claim to its page.
 */
export function ResearchSources({ research }: { research: NonNullable<Message['research']> }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!research.sources.length) return null;

  const rewritten = research.searchedQuery && research.searchedQuery !== research.query;

  return (
    <View style={styles.sourcesWrap}>
      <Text style={styles.label}>
        {research.sources.length} source{research.sources.length === 1 ? '' : 's'}
      </Text>

      {research.sources.map((s, i) => (
        <PressableScale
          key={`${s.url}-${i}`}
          style={styles.sourceRow}
          scaleTo={0.985}
          onPress={() => { void Linking.openURL(s.url); }}
        >
          <View style={[styles.numChip, s.cited === false && styles.numChipQuiet]}>
            <Text style={[styles.numText, s.cited === false && styles.numTextQuiet]}>{i + 1}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.sourceTitle} numberOfLines={2}>{s.title || domainOf(s.url)}</Text>
            <Text style={styles.domain} numberOfLines={1}>{domainOf(s.url)}</Text>
          </View>
        </PressableScale>
      ))}

      {rewritten && (
        <Text style={styles.searchedFoot} numberOfLines={2}>
          Searched for “{research.searchedQuery}”
        </Text>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgCard,
    gap: spacing.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headText: { color: c.text, ...typography.sectionTitle },
  searched: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.serifItalic, lineHeight: 17 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stateCol: { width: 14, alignItems: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  domain: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sansMedium },
  title: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sans, marginTop: 1 },
  dim: { opacity: 0.5 },

  sourcesWrap: { marginTop: spacing.md, gap: spacing.sm },
  label: { color: c.textMuted, ...typography.label },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgCard,
  },
  numChip: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.violetDim,
    marginTop: 1,
  },
  numChipQuiet: { backgroundColor: c.bgInput },
  numText: { color: c.violet, fontSize: fontSize.micro, fontFamily: fonts.sansSemibold },
  numTextQuiet: { color: c.textMuted },
  sourceTitle: { color: c.text, fontSize: fontSize.sm2, fontFamily: fonts.sansMedium, lineHeight: 18 },
  searchedFoot: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.serifItalic, lineHeight: 17 },
});

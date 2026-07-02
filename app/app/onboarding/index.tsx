import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Animated, Image, Easing, KeyboardAvoidingView, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useProfileStore } from '@/state/useProfileStore';
import { Aurora } from '@/components/ds/Aurora';
import { Button } from '@/components/ds/Button';
import { LegalDocumentModal } from '@/components/legal/LegalDocumentModal';
import { PressableScale } from '@/components/ds/PressableScale';
import { LOGO_PURPLE, LOGO_WHITE } from '@/components/ds/Logo';
import { getLegalDocument, type LegalDocument } from '@/legal/documents';
import { spacing, radius, fonts, Palette, fontSize } from '@/theme';
import { useColors, useIsDark } from '@/theme/useColors';

const INTRO = [
  { kicker: 'Welcome', brand: true, title: 'A private assistant on your phone.', body: 'Chat, read files, look at images, and work through ideas with a model that runs locally.' },
  { kicker: 'Core', title: 'Memory stays under your control.', body: 'Aether can save useful details from conversations so future replies have context. You can edit or clear them anytime.' },
  { kicker: 'Research', title: 'Use the web only when you ask.', body: 'Research mode reads public sources for a grounded answer. Regular chat stays on-device after the model is downloaded.' },
];

function Chevron({ dir, color }: { dir: 'left' | 'right'; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d={dir === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function NavRow({ canBack, onBack, dots, active, onNext, nextDisabled }: {
  canBack: boolean; onBack: () => void; dots: number; active: number; onNext: () => void; nextDisabled?: boolean;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c, true), [c]);
  return (
    <View style={styles.nav}>
      <PressableScale
        onPress={onBack}
        disabled={!canBack}
        style={[styles.navCircle, { borderWidth: 1, borderColor: c.border, opacity: canBack ? 1 : 0 }]}
      >
        <Chevron dir="left" color={c.text} />
      </PressableScale>

      <View style={styles.dots}>
        {Array.from({ length: dots }).map((_, i) => (
          <View key={i} style={{ width: i === active ? 22 : 6, height: 6, borderRadius: radius.full, backgroundColor: i === active ? c.violet : c.border }} />
        ))}
      </View>

      <PressableScale
        onPress={onNext}
        disabled={nextDisabled}
        style={[styles.navCircle, { backgroundColor: nextDisabled ? c.bgCard : c.violet }]}
        haptic
      >
        <Chevron dir="right" color={c.white} />
      </PressableScale>
    </View>
  );
}

function IntroVisual({ isDark, halo }: { isDark: boolean; halo: object }) {
  return (
    <View style={styles.visual}>
      <View style={halo} />
      <Image source={isDark ? LOGO_WHITE : LOGO_PURPLE} style={{ width: 76, height: 76 }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  visual: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
});

function BetaReleaseGate({ onAccepted }: { onAccepted: () => void }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c, false), [c]);
  const accept = useProfileStore((st) => st.acceptCurrentBetaTerms);
  const [openDoc, setOpenDoc] = useState<LegalDocument | null>(null);
  const [accepting, setAccepting] = useState(false);

  const approve = async () => {
    setAccepting(true);
    try {
      await accept();
      onAccepted();
    } finally {
      setAccepting(false);
    }
  };

  return (
    <View style={s.root}>
      <SafeAreaView style={s.legalSafe} edges={['top', 'bottom']}>
        <View style={s.legalBody}>
          <Text style={s.legalEyebrow}>Closed beta</Text>
          <Text style={s.legalTitle}>Review the beta notice before using Aether.</Text>
          <Text style={s.legalCopy}>
            Aether is still being tested. Regular chat is designed to run on this device after a model is installed,
            while Research and model downloads use online services when you start them.
          </Text>

          <View style={s.docLinks}>
            <PressableScale style={s.docLink} onPress={() => setOpenDoc(getLegalDocument('beta-terms'))} scaleTo={0.98}>
              <Text style={s.docLinkTitle}>Closed Beta Terms</Text>
              <Text style={s.docLinkMeta}>Required acceptance</Text>
            </PressableScale>
            <PressableScale style={s.docLink} onPress={() => setOpenDoc(getLegalDocument('privacy-notice'))} scaleTo={0.98}>
              <Text style={s.docLinkTitle}>Privacy Notice</Text>
              <Text style={s.docLinkMeta}>Readable before entry</Text>
            </PressableScale>
          </View>
        </View>

        <View style={s.legalActions}>
          <Button label="Accept and continue" onPress={approve} loading={accepting} />
          <Button label="Not now" onPress={() => BackHandler.exitApp()} variant="secondary" />
          <Text style={s.legalFootnote}>
            Declining keeps the app at this gate. You can reopen the documents any time from here.
          </Text>
        </View>
      </SafeAreaView>
      <LegalDocumentModal document={openDoc} visible={!!openDoc} onClose={() => setOpenDoc(null)} />
    </View>
  );
}

export default function Onboarding() {
  const c = useColors();
  const isDark = useIsDark();
  const s = useMemo(() => makeStyles(c, isDark), [c, isDark]);
  const complete = useProfileStore((st) => st.completeOnboarding);
  const releaseGateAccepted = useProfileStore((st) => st.releaseGateAccepted);
  const onboarded = useProfileStore((st) => st.onboarded);
  const [phase, setPhase] = useState(0); // 0..2 intro, 3 name, 4 goal
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 440, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [phase, anim]);
  const animStyle = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };

  const back = () => setPhase((p) => Math.max(0, p - 1));
  const finish = (withGoal: string) =>
    complete({ name: name.trim() || 'there', occupation: '', project: '', goals: withGoal.trim(), language: 'English' })
      .then(() => router.replace('/(main)'));

  if (!releaseGateAccepted) {
    return <BetaReleaseGate onAccepted={() => { if (onboarded) router.replace('/(main)'); }} />;
  }

  if (phase <= 2) {
    const intro = INTRO[phase];
    return (
      <View style={s.root}>
        <Aurora />
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.topbar}>
            <View />
            <Pressable onPress={() => setPhase(3)}><Text style={s.skip}>Skip</Text></Pressable>
          </View>

          <Animated.View style={[s.center, animStyle]}>
            <IntroVisual isDark={isDark} halo={s.halo} />
            <Text style={s.kicker}>{intro.kicker}</Text>
            {intro.brand && <Text style={s.brand}>Aether</Text>}
            <Text style={s.introTitle}>{intro.title}</Text>
            <Text style={s.introBody}>{intro.body}</Text>
          </Animated.View>

          <View style={s.navWrap}>
            <NavRow canBack={phase > 0} onBack={back} dots={3} active={phase} onNext={() => setPhase(phase + 1)} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isName = phase === 3;
  const value = isName ? name : goal;
  const setValue = isName ? setName : setGoal;
  const step = isName
    ? { title: 'What should I call you?', sub: 'Used only to make replies feel natural. Stored on this device.', placeholder: 'Your name' }
    : { title: 'What are you working on?', sub: 'Optional context Aether can keep in mind across chats.', placeholder: 'e.g. writing, coding, learning...' };
  const nextDisabled = isName && !name.trim();
  const go = () => (isName ? setPhase(4) : finish(goal));

  return (
    <View style={s.root}>
      <Aurora />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={s.flex} behavior="padding">
        <View style={s.brandRow}>
          <Image source={LOGO_PURPLE} style={{ width: 30, height: 30 }} resizeMode="contain" />
          <Text style={s.brandSm}>Aether</Text>
        </View>

        <Animated.View style={[s.profile, animStyle]}>
          <Text style={s.stepTitle}>{step.title}</Text>
          <Text style={s.stepSub}>{step.sub}</Text>
          <TextInput
            style={s.input}
            placeholder={step.placeholder}
            placeholderTextColor={c.textMuted}
            value={value}
            onChangeText={setValue}
            autoFocus
          />
          {!isName && (
            <Pressable onPress={() => finish('')}><Text style={s.skipInline}>Skip for now</Text></Pressable>
          )}
        </Animated.View>

        <View style={s.navWrap}>
          <NavRow canBack onBack={back} dots={2} active={phase - 3} onNext={go} nextDisabled={nextDisabled} />
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c: Palette, isDark: boolean) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.xl },
  legalSafe: { flex: 1, paddingHorizontal: spacing.xl },
  legalBody: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  legalEyebrow: { fontFamily: fonts.sansSemibold, fontSize: fontSize.xs, letterSpacing: 0, color: c.textMuted, textTransform: 'uppercase' },
  legalTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.display, lineHeight: 36, color: c.text },
  legalCopy: { fontFamily: fonts.sans, fontSize: fontSize.base, lineHeight: 21, color: c.textMuted },
  docLinks: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.border },
  docLink: { borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: spacing.md },
  docLinkTitle: { fontFamily: fonts.sansSemibold, fontSize: fontSize.base, color: c.text },
  docLinkMeta: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: c.textMuted, marginTop: 3 },
  legalActions: { gap: spacing.sm, paddingBottom: spacing.lg },
  legalFootnote: { fontFamily: fonts.sans, fontSize: fontSize.xs, lineHeight: 16, color: c.textMuted, textAlign: 'center' },
  topbar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { fontFamily: fonts.sans, fontSize: fontSize.base, color: c.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  halo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(109,40,217,0.07)' },
  kicker: { fontFamily: fonts.sansSemibold, fontSize: fontSize.sm, letterSpacing: 0, color: isDark ? '#C9A9FF' : c.violet, marginTop: 14, textTransform: 'uppercase' },
  brand: { fontFamily: fonts.displayBold, fontSize: fontSize.brand, color: c.text, marginTop: spacing.xs },
  introTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, lineHeight: 30, color: c.text, textAlign: 'center', maxWidth: 300, marginTop: spacing.md },
  introBody: { fontFamily: fonts.sans, fontSize: fontSize.body, lineHeight: 23, color: c.textMuted, textAlign: 'center', maxWidth: 300, marginTop: spacing.sm },
  navWrap: { paddingBottom: spacing.lg },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: 10 },
  navCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  brandRow: { height: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandSm: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, color: c.text },
  profile: { flex: 1, justifyContent: 'center', gap: 14 },
  stepTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.display, lineHeight: 36, color: c.text },
  stepSub: { fontFamily: fonts.sans, fontSize: fontSize.base, lineHeight: 21, color: c.textMuted, maxWidth: 320 },
  input: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, color: c.text, paddingHorizontal: 14, paddingVertical: spacing.md, fontSize: fontSize.md, fontFamily: fonts.sans, marginTop: spacing.sm },
  skipInline: { fontFamily: fonts.sans, fontSize: fontSize.base, color: c.textMuted, alignSelf: 'flex-start' },
});

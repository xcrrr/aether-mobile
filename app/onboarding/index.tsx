import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Animated, Image, Easing } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useProfileStore } from '@/state/useProfileStore';
import { Aurora } from '@/components/ds/Aurora';
import { LOGO_PURPLE, LOGO_WHITE } from '@/components/ds/Logo';
import { spacing, radius, fonts, Palette } from '@/theme';
import { useColors, useIsDark } from '@/theme/useColors';

const INTRO = [
  { kicker: 'Welcome to', brand: true, title: 'Your private second brain.', body: 'A complete AI assistant that thinks, remembers, and researches — running entirely on your phone.' },
  { kicker: 'Second brain', title: 'Remembers what matters to you.', body: 'Aether keeps a private memory of your notes, ideas, and conversations — stored only on this device.' },
  { kicker: 'Private AI research', title: 'Research without giving yourself away.', body: 'Explore topics, dig through the web, and reason over what you find. No cloud, no accounts, no telemetry — ever.' },
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
      <Pressable
        onPress={onBack}
        disabled={!canBack}
        style={[styles.navCircle, { borderWidth: 1, borderColor: c.border, opacity: canBack ? 1 : 0 }]}
      >
        <Chevron dir="left" color={c.text} />
      </Pressable>

      <View style={styles.dots}>
        {Array.from({ length: dots }).map((_, i) => (
          <View key={i} style={{ width: i === active ? 22 : 6, height: 6, borderRadius: 999, backgroundColor: i === active ? c.violet : c.border }} />
        ))}
      </View>

      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        style={[styles.navCircle, { backgroundColor: nextDisabled ? c.bgCard : c.violet }]}
      >
        <Chevron dir="right" color={c.white} />
      </Pressable>
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

export default function Onboarding() {
  const c = useColors();
  const isDark = useIsDark();
  const s = useMemo(() => makeStyles(c, isDark), [c, isDark]);
  const complete = useProfileStore((st) => st.completeOnboarding);
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
    ? { title: 'What should I call you?', sub: 'Your name is added to every conversation so replies feel personal. Stored only on this device.', placeholder: 'Your name' }
    : { title: 'How can I help?', sub: 'A short note about what you want help with. This is injected into the system prompt.', placeholder: 'e.g. writing, coding, learning…' };
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
  topbar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { fontFamily: fonts.sans, fontSize: 14, color: c.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  halo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(109,40,217,0.07)' },
  kicker: { fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 1.4, color: isDark ? '#C9A9FF' : c.violet, marginTop: 14, textTransform: 'uppercase' },
  brand: { fontFamily: fonts.sansHeavy, fontSize: 44, color: c.text, letterSpacing: -0.9, marginTop: 4 },
  introTitle: { fontFamily: fonts.displayBold, fontSize: 25, lineHeight: 30, color: c.text, textAlign: 'center', maxWidth: 300, marginTop: 12 },
  introBody: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: c.textMuted, textAlign: 'center', maxWidth: 300, marginTop: 8 },
  navWrap: { paddingBottom: spacing.lg },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 },
  navCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  brandRow: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandSm: { fontFamily: fonts.sansHeavy, fontSize: 24, color: c.text, letterSpacing: -0.5 },
  profile: { flex: 1, justifyContent: 'center', gap: 14 },
  stepTitle: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36, color: c.text },
  stepSub: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: c.textMuted, maxWidth: 320 },
  input: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, color: c.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: fonts.sans, marginTop: 8 },
  skipInline: { fontFamily: fonts.sans, fontSize: 14, color: c.textMuted, alignSelf: 'flex-start' },
});

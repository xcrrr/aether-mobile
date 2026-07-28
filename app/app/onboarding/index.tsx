import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Animated, Image, Easing, KeyboardAvoidingView, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useProfileStore } from '@/state/useProfileStore';
import { useModelStore } from '@/state/useModelStore';
import { MODELS, MODES, DEFAULT_MODEL_ID } from '@/models/registry';
import { Aurora } from '@/components/ds/Aurora';
import { Button } from '@/components/ds/Button';
import { Badge } from '@/components/ds/Badge';
import { LegalDocumentModal } from '@/components/legal/LegalDocumentModal';
import { PressableScale } from '@/components/ds/PressableScale';
import { CoreGrowthVisual } from '@/components/onboarding/CoreGrowthVisual';
import { LOGO_PURPLE, LOGO_WHITE } from '@/components/ds/Logo';
import { getLegalDocument, type LegalDocument } from '@/legal/documents';
import { TASK_UI_ENABLED } from '@/release/features';
import { spacing, radius, fonts, Palette, fontSize } from '@/theme';
import { useColors, useIsDark } from '@/theme/useColors';

const PAGE_COUNT = 4; // Welcome, Core, Model, Research & Task — Ready/Legal is the terminal screen

function Chevron({ dir, color }: { dir: 'left' | 'right'; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d={dir === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <PressableScale onPress={onPress} style={styles.backLink} hitSlop={10}>
      <Chevron dir="left" color={c.textMuted} />
      <Text style={{ fontFamily: fonts.sans, fontSize: fontSize.base, color: c.textMuted }}>Back</Text>
    </PressableScale>
  );
}

function NavRow({ canBack, onBack, dots, active, onNext, nextDisabled }: {
  canBack: boolean; onBack: () => void; dots: number; active: number; onNext: () => void; nextDisabled?: boolean;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c, true), [c]);
  return (
    <View style={s.nav}>
      <PressableScale
        onPress={onBack}
        disabled={!canBack}
        style={[s.navCircle, { borderWidth: 1, borderColor: c.border, opacity: canBack ? 1 : 0 }]}
      >
        <Chevron dir="left" color={c.text} />
      </PressableScale>

      <View style={s.dots}>
        {Array.from({ length: dots }).map((_, i) => (
          <View key={i} style={{ width: i === active ? 22 : 6, height: 6, borderRadius: radius.full, backgroundColor: i === active ? c.violet : c.border }} />
        ))}
      </View>

      <PressableScale
        onPress={onNext}
        disabled={nextDisabled}
        style={[s.navCircle, { backgroundColor: nextDisabled ? c.bgCard : c.violet }]}
        haptic
      >
        <Chevron dir="right" color={c.white} />
      </PressableScale>
    </View>
  );
}

function IntroVisual({ isDark, halo }: { isDark: boolean; halo: object }) {
  return (
    <View style={visualBox.visual}>
      <View style={halo} />
      <Image source={isDark ? LOGO_WHITE : LOGO_PURPLE} style={{ width: 76, height: 76 }} resizeMode="contain" />
    </View>
  );
}
const visualBox = StyleSheet.create({
  visual: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
});

function ModelChoiceCard({ id, name, badge, sizeLabel, desc, selected, onSelect }: {
  id: string; name: string; badge?: string; sizeLabel: string; desc: string; selected: boolean; onSelect: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c, true), [c]);
  return (
    <PressableScale
      onPress={onSelect}
      scaleTo={0.985}
      style={[s.modelCard, { borderColor: selected ? c.violet : c.border, backgroundColor: selected ? c.violetDim : c.bgCard }]}
    >
      <View style={s.modelCardHead}>
        <View style={[s.radio, { borderColor: selected ? c.violet : c.border }]}>
          {selected && <View style={[s.radioDot, { backgroundColor: c.violet }]} />}
        </View>
        <Text style={s.modelName}>{name}</Text>
        {!!badge && <Badge label={badge} tone={badge === 'Recommended' ? 'accent' : 'blue'} />}
      </View>
      <Text style={s.modelDesc}>{desc}</Text>
      <Text style={s.modelMeta}>{sizeLabel}</Text>
    </PressableScale>
  );
}

function CapabilityCard({ label, badge, body }: { label: string; badge?: string; body: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c, true), [c]);
  return (
    <View style={s.capCard}>
      <View style={s.capHead}>
        <Text style={s.capLabel}>{label}</Text>
        {!!badge && <Badge label={badge} tone="accent" />}
      </View>
      <Text style={s.capBody}>{body}</Text>
    </View>
  );
}

/** Compact re-acceptance gate for a returning, already-onboarded user whose beta
 * terms version changed. Never shown to a first-run user — see Onboarding below. */
function TermsReacceptanceGate({ onAccepted }: { onAccepted: () => void }) {
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
          <Text style={s.legalEyebrow}>Updated beta terms</Text>
          <Text style={s.legalTitle}>Please review the updated beta notice.</Text>
          <Text style={s.legalCopy}>
            Aether's beta terms have changed since you last accepted them. Review the documents below to keep using the app.
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
  const acceptBetaTerms = useProfileStore((st) => st.acceptCurrentBetaTerms);
  const releaseGateAccepted = useProfileStore((st) => st.releaseGateAccepted);
  const onboarded = useProfileStore((st) => st.onboarded);
  const installed = useModelStore((st) => st.installed);
  const refreshInstalled = useModelStore((st) => st.refreshInstalled);
  const setActiveModel = useModelStore((st) => st.setActive);
  const downloadModel = useModelStore((st) => st.download);

  const [phase, setPhase] = useState(0); // 0 welcome, 1 core, 2 model, 3 research&task, 4 ready/legal
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [openDoc, setOpenDoc] = useState<LegalDocument | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => { void refreshInstalled(); }, [refreshInstalled]);

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

  const finish = async () => {
    setAccepting(true);
    try {
      await complete({ name: name.trim() || 'there', occupation: '', project: '', goals: '', language: 'English' });
      await acceptBetaTerms();
      await setActiveModel(modelId);
      if (!installed[modelId]) void downloadModel(modelId);
      router.replace('/(main)');
    } finally {
      setAccepting(false);
    }
  };

  // Returning user whose beta terms version changed — short reacceptance only,
  // never the full first-run tour.
  if (!releaseGateAccepted && onboarded) {
    return <TermsReacceptanceGate onAccepted={() => router.replace('/(main)')} />;
  }

  if (phase === 0) {
    return (
      <View style={s.root}>
        <Aurora />
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.topbar}>
            <View />
            <Pressable onPress={() => setPhase(4)}><Text style={s.skip}>Skip</Text></Pressable>
          </View>
          <Animated.View style={[s.center, animStyle]}>
            <IntroVisual isDark={isDark} halo={s.halo} />
            <Text style={s.kicker}>Welcome</Text>
            <Text style={s.brand}>Aether</Text>
            <Text style={s.introTitle}>A private assistant on your phone.</Text>
            <Text style={s.introBody}>Chat, read files, look at images, and work through ideas with a model that runs on this device once it's downloaded.</Text>
          </Animated.View>
          <View style={s.navWrap}>
            <NavRow canBack={false} onBack={back} dots={PAGE_COUNT} active={phase} onNext={() => setPhase(1)} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 1) {
    return (
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.topbar}>
            <View />
            <Pressable onPress={() => setPhase(4)}><Text style={s.skip}>Skip</Text></Pressable>
          </View>
          <Animated.View style={[s.center, animStyle]}>
            <View style={s.coreVisual}>
              <CoreGrowthVisual size={200} />
            </View>
            <Text style={s.kicker}>Core</Text>
            <Text style={s.introTitle}>Your Core grows with you.</Text>
            <Text style={s.introBody}>Aether can keep useful details from your conversations so replies don't start from zero. Review, edit, or clear what it keeps, anytime.</Text>
          </Animated.View>
          <View style={s.navWrap}>
            <NavRow canBack onBack={back} dots={PAGE_COUNT} active={phase} onNext={() => setPhase(2)} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 2) {
    return (
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.topbar}>
            <View />
            <Pressable onPress={() => setPhase(4)}><Text style={s.skip}>Skip</Text></Pressable>
          </View>
          <Animated.View style={[s.listPage, animStyle]}>
            <Text style={s.pageTitle}>Choose a model to start.</Text>
            <Text style={s.pageSub}>Regular chat runs on this device once a model is downloaded. Add the other, or switch, anytime in Settings.</Text>
            <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
              {MODELS.map((m) => {
                const mode = MODES.find((mo) => mo.modelId === m.id);
                return (
                  <ModelChoiceCard
                    key={m.id}
                    id={m.id}
                    name={mode ? `${mode.label} — ${m.name}` : m.name}
                    badge={m.badge}
                    sizeLabel={m.sizeLabel}
                    desc={mode?.desc ?? m.description}
                    selected={modelId === m.id}
                    onSelect={() => setModelId(m.id)}
                  />
                );
              })}
            </View>
          </Animated.View>
          <View style={s.navWrap}>
            <NavRow canBack onBack={back} dots={PAGE_COUNT} active={phase} onNext={() => setPhase(3)} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 3) {
    return (
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.topbar}>
            <View />
            <Pressable onPress={() => setPhase(4)}><Text style={s.skip}>Skip</Text></Pressable>
          </View>
          <Animated.View style={[s.listPage, animStyle]}>
            <Text style={s.pageTitle}>
              {TASK_UI_ENABLED ? 'Two modes, used on purpose.' : 'One mode, used on purpose.'}
            </Text>
            <Text style={s.pageSub}>
              {TASK_UI_ENABLED
                ? 'Regular chat stays on this device. These two step outside it, only when you choose to.'
                : 'Regular chat stays on this device. Research steps outside it, only when you choose to.'}
            </Text>
            <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
              <CapabilityCard
                label="Research"
                body="Reads public web sources for a grounded, cited answer. You turn it on per message — regular chat never does this on its own."
              />
              {TASK_UI_ENABLED && (
                <CapabilityCard
                  label="Task"
                  badge="Beta"
                  body="Takes on bigger, multi-step requests and can act with your approval. Still learning — review what it does before relying on it."
                />
              )}
            </View>
          </Animated.View>
          <View style={s.navWrap}>
            <NavRow canBack onBack={back} dots={PAGE_COUNT} active={phase} onNext={() => setPhase(4)} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // phase 4 — Ready: name (optional) + legal acceptance, the single terminal gate.
  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={s.flex} behavior="padding">
          <View style={s.topbar}>
            <BackLink onPress={back} />
            <View />
          </View>
          <Animated.View style={[s.readyBody, animStyle]}>
            <Text style={s.legalEyebrow}>Almost there</Text>
            <Text style={s.legalTitle}>Make it yours, then step in.</Text>

            <View style={{ marginTop: spacing.md }}>
              <Text style={s.fieldLabel}>What should I call you?</Text>
              <TextInput
                style={s.input}
                placeholder="Your name (optional)"
                placeholderTextColor={c.textMuted}
                value={name}
                onChangeText={setName}
              />
              <Text style={s.fieldHint}>Used only to make replies feel natural. Stored on this device.</Text>
            </View>

            <View style={s.docLinks}>
              <PressableScale style={s.docLink} onPress={() => setOpenDoc(getLegalDocument('beta-terms'))} scaleTo={0.98}>
                <Text style={s.docLinkTitle}>Closed Beta Terms</Text>
                <Text style={s.docLinkMeta}>Required acceptance</Text>
              </PressableScale>
              <PressableScale style={s.docLink} onPress={() => setOpenDoc(getLegalDocument('privacy-notice'))} scaleTo={0.98}>
                <Text style={s.docLinkTitle}>Privacy Notice</Text>
                <Text style={s.docLinkMeta}>Readable before entry</Text>
              </PressableScale>
              <PressableScale style={s.docLink} onPress={() => setOpenDoc(getLegalDocument('ai-safety-notice'))} scaleTo={0.98}>
                <Text style={s.docLinkTitle}>AI Safety Notice</Text>
                <Text style={s.docLinkMeta}>Readable before entry</Text>
              </PressableScale>
            </View>
          </Animated.View>

          <View style={s.legalActions}>
            <Button label="Accept and continue" onPress={finish} loading={accepting} />
            <Button label="Not now" onPress={() => BackHandler.exitApp()} variant="secondary" />
            <Text style={s.legalFootnote}>
              Declining keeps the app at this gate. You can reopen the documents any time from here.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <LegalDocumentModal document={openDoc} visible={!!openDoc} onClose={() => setOpenDoc(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm },
});

const makeStyles = (c: Palette, isDark: boolean) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.xl },
  legalSafe: { flex: 1, paddingHorizontal: spacing.xl },
  legalBody: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  readyBody: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  legalEyebrow: { fontFamily: fonts.sansSemibold, fontSize: fontSize.xs, letterSpacing: 0, color: c.textMuted, textTransform: 'uppercase' },
  legalTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.display, lineHeight: 36, color: c.text },
  legalCopy: { fontFamily: fonts.sans, fontSize: fontSize.base, lineHeight: 21, color: c.textMuted },
  fieldLabel: { fontFamily: fonts.sansSemibold, fontSize: fontSize.base, color: c.text, marginTop: spacing.md },
  fieldHint: { fontFamily: fonts.sans, fontSize: fontSize.xs, lineHeight: 16, color: c.textMuted, marginTop: spacing.xs },
  input: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, color: c.text, paddingHorizontal: 14, paddingVertical: spacing.sm, fontSize: fontSize.md, fontFamily: fonts.sans, marginTop: spacing.xs },
  docLinks: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: c.border },
  docLink: { borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: spacing.md },
  docLinkTitle: { fontFamily: fonts.sansSemibold, fontSize: fontSize.base, color: c.text },
  docLinkMeta: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: c.textMuted, marginTop: 3 },
  legalActions: { gap: spacing.sm, paddingBottom: spacing.lg },
  legalFootnote: { fontFamily: fonts.sans, fontSize: fontSize.xs, lineHeight: 16, color: c.textMuted, textAlign: 'center' },
  topbar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { fontFamily: fonts.sans, fontSize: fontSize.base, color: c.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  halo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(109,40,217,0.07)' },
  coreVisual: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  kicker: { fontFamily: fonts.sansSemibold, fontSize: fontSize.sm, letterSpacing: 0, color: isDark ? '#C9A9FF' : c.violet, marginTop: 14, textTransform: 'uppercase' },
  brand: { fontFamily: fonts.displayBold, fontSize: fontSize.brand, color: c.text, marginTop: spacing.xs },
  introTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, lineHeight: 30, color: c.text, textAlign: 'center', maxWidth: 300, marginTop: spacing.md },
  introBody: { fontFamily: fonts.sans, fontSize: fontSize.body, lineHeight: 23, color: c.textMuted, textAlign: 'center', maxWidth: 300, marginTop: spacing.sm },
  listPage: { flex: 1, justifyContent: 'center' },
  pageTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.display, lineHeight: 36, color: c.text },
  pageSub: { fontFamily: fonts.sans, fontSize: fontSize.base, lineHeight: 21, color: c.textMuted, marginTop: spacing.sm, maxWidth: 340 },
  navWrap: { paddingBottom: spacing.lg },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: 10 },
  navCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  modelCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  modelCardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  modelName: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: fontSize.md, color: c.text },
  modelDesc: { fontFamily: fonts.sans, fontSize: fontSize.base, lineHeight: 20, color: c.textMuted, marginTop: spacing.sm },
  modelMeta: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: c.textMuted, marginTop: spacing.xs },
  capCard: { borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.lg, backgroundColor: c.bgCard },
  capHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  capLabel: { fontFamily: fonts.sansSemibold, fontSize: fontSize.md, color: c.text },
  capBody: { fontFamily: fonts.sans, fontSize: fontSize.base, lineHeight: 20, color: c.textMuted, marginTop: spacing.sm },
});

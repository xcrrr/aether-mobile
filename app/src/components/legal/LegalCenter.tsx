import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { PressableScale } from '@/components/ds/PressableScale';
import { LEGAL_DOCUMENTS, type LegalDocument } from '@/legal/documents';
import { useProfileStore } from '@/state/useProfileStore';
import { useAgentStore } from '@/state/useAgentStore';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { MemoryStore } from '@/secondbrain/MemoryStore';
import { resetAetherLocalData } from '@/release/localDataReset';
import { ANDROID_PACKAGE_ID, APP_BUILD_NUMBER, APP_VERSION } from '@/release/appInfo';
import { Palette, radius, spacing, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { LegalDocumentModal } from './LegalDocumentModal';

export function LegalCenter() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const legalAcceptance = useProfileStore((s) => s.legalAcceptance);
  const hydrateProfile = useProfileStore((s) => s.hydrate);
  const resetChatState = useChatStore((s) => s.resetLocalState);
  const resetModelState = useModelStore((s) => s.resetLocalState);
  const resetAgentState = useAgentStore((s) => s.resetLocalState);
  const [openDoc, setOpenDoc] = useState<LegalDocument | null>(null);

  const reset = () => {
    Alert.alert(
      'Reset local Aether data?',
      'This removes local profile, conversations, Core memory, agent task records, legal acceptance records, downloaded models, and stored chat images on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void resetAetherLocalData().then(async () => {
              resetChatState();
              resetModelState();
              resetAgentState();
              MemoryStore.resetLocalState();
              await hydrateProfile();
              router.replace('/onboarding');
            });
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Legal & Privacy</Text>
      <View style={styles.group}>
        {LEGAL_DOCUMENTS.map((doc) => {
          const record = legalAcceptance[doc.id];
          const current = record?.version === doc.version;
          return (
            <PressableScale key={doc.id} style={styles.row} onPress={() => setOpenDoc(doc)} scaleTo={0.98}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{doc.title}</Text>
                <Text style={styles.rowMeta}>
                  v{doc.version} · {current ? `accepted ${record?.acceptedAt.slice(0, 10)}` : doc.requiredAcceptance ? 'acceptance required' : 'available'}
                </Text>
              </View>
              <ChevronRight size={18} color={c.textMuted} strokeWidth={1.8} />
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.info}>
        <Text style={styles.infoText}>App version {APP_VERSION} ({APP_BUILD_NUMBER})</Text>
        <Text style={styles.infoText}>Android package {ANDROID_PACKAGE_ID}</Text>
        <Text style={styles.infoText}>Support/privacy contact: publisher setup required.</Text>
      </View>

      <PressableScale style={styles.resetBtn} onPress={reset} scaleTo={0.98}>
        <Text style={styles.resetText}>Reset local Aether data</Text>
      </PressableScale>

      <LegalDocumentModal document={openDoc} visible={!!openDoc} onClose={() => setOpenDoc(null)} />
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  section: { gap: spacing.md },
  label: { color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0, ...typography.metadata },
  group: { borderTopWidth: 1, borderTopColor: c.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: c.text, ...typography.sectionTitle },
  rowMeta: { color: c.textMuted, marginTop: 3, ...typography.metadata },
  info: { gap: 4 },
  infoText: { color: c.textMuted, ...typography.bodySmall },
  resetBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  resetText: { color: c.danger, ...typography.label },
});

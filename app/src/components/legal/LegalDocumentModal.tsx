import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { PressableScale } from '@/components/ds/PressableScale';
import { type LegalDocument } from '@/legal/documents';
import { fonts, fontSize, Palette, spacing, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

export function LegalDocumentModal({
  document,
  visible,
  onClose,
  footer,
}: {
  document: LegalDocument | null;
  visible: boolean;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <Modal visible={visible && !!document} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{document?.title}</Text>
            <Text style={styles.meta}>Version {document?.version} · Effective {document?.effectiveDate}</Text>
          </View>
          <PressableScale onPress={onClose} hitSlop={10} style={styles.close}>
            <X size={22} color={c.text} strokeWidth={1.8} />
          </PressableScale>
        </View>

        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.content}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{document?.reviewNotice}</Text>
          </View>
          <Text style={styles.summary}>{document?.summary}</Text>
          {document?.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>
              {section.body.map((paragraph) => (
                <Text key={paragraph} style={styles.body}>{paragraph}</Text>
              ))}
            </View>
          ))}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, ...typography.screenTitle },
  meta: { color: c.textMuted, marginTop: 4, ...typography.metadata },
  scroller: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  notice: { borderLeftWidth: 2, borderLeftColor: c.border, paddingLeft: spacing.md },
  noticeText: { color: c.text, ...typography.bodySmall },
  summary: {
    color: c.text,
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    lineHeight: 27,
  },
  section: { gap: spacing.sm },
  heading: { color: c.text, ...typography.sectionTitle },
  body: { color: c.textMuted, ...typography.body },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bg,
  },
});

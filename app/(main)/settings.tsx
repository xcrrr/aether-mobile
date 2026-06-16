import { useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MODELS } from '@/models/registry';
import * as MM from '@/models/ModelManager';
import { useModelStore } from '@/state/useModelStore';
import * as Llama from '@/llm/LlamaService';
import { StorageBar } from '@/components/settings/StorageBar';
import { ModelManagerRow } from '@/components/settings/ModelManagerRow';
import { colors, spacing } from '@/theme';

export default function Settings() {
  const { installed, downloads, download, cancel, remove } = useModelStore();
  const [disk, setDisk] = useState({ total: 0, free: 0, used: 0 });

  const refresh = useCallback(() => {
    (async () => {
      const [total, free, used] = await Promise.all([MM.totalBytes(), MM.freeBytes(), MM.installedBytes()]);
      setDisk({ total, free, used });
    })();
  }, []);
  useFocusEffect(refresh);

  return (
    <ScrollView style={styles.c} contentContainerStyle={{ padding: spacing.lg }}>
      <StorageBar total={disk.total} free={disk.free} aetherUsed={disk.used} />
      <Text style={styles.h}>Models</Text>
      {MODELS.map((m) => (
        <ModelManagerRow
          key={m.id}
          model={m}
          installed={!!installed[m.id]}
          download={downloads[m.id]}
          onDownload={() => download(m.id)}
          onCancel={() => cancel(m.id)}
          onDelete={async () => { await Llama.releaseLlm(); await remove(m.id); refresh(); }}
        />
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  h: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
});

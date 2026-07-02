import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const AETHER_PREFIX = '@aether/';
const SECOND_BRAIN_KEY = 'aether_second_brain';
const AGENT_MODE_KEY = '@aether/agent-mode';

async function deleteDirectory(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function resetAetherLocalData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const aetherKeys = keys.filter(
    (key) => key.startsWith(AETHER_PREFIX) || key === SECOND_BRAIN_KEY || key === AGENT_MODE_KEY,
  );
  if (aetherKeys.length) await AsyncStorage.multiRemove(aetherKeys);

  await Promise.all([
    deleteDirectory(FileSystem.documentDirectory ? `${FileSystem.documentDirectory}models` : null),
    deleteDirectory(FileSystem.documentDirectory ? `${FileSystem.documentDirectory}chat-media` : null),
  ]);
}


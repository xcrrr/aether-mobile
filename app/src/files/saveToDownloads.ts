import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from '@/storage/keys';
import { resolveCollision } from './artifactFilename';

/**
 * Saves a generated PDF into a user-visible, public folder using the Storage
 * Access Framework — the scoped-storage-correct path on Android 10+ (minSdk 29)
 * that needs NO broad storage permission.
 *
 * The first export asks the user to pick a destination folder once (Downloads is
 * the natural choice); that grant is persisted and reused silently afterwards.
 * Files land as real `content://` documents, findable from the Files app and the
 * Downloads area.
 */

const SAF = FileSystem.StorageAccessFramework;

export interface SavedArtifact {
  /** content:// uri of the written PDF (openable / shareable). */
  uri: string;
  /** Final on-disk filename (after collision resolution). */
  filename: string;
  /** Human label for where it landed, e.g. "Downloads". */
  location: string;
}

export class SaveCancelledError extends Error {
  constructor() {
    super('Save location was not granted');
    this.name = 'SaveCancelledError';
  }
}

/** Decode the display name at the tail of a SAF document/tree uri. */
function displayNameFromUri(uri: string): string {
  const tail = uri.split('%2F').pop() ?? uri.split('/').pop() ?? '';
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

/** Friendly label for a granted tree uri ("Downloads" when it looks like it). */
function locationLabel(treeUri: string): string {
  const decoded = decodeURIComponent(treeUri);
  if (/download/i.test(decoded)) return 'Downloads';
  const name = displayNameFromUri(treeUri);
  return name || 'your Files folder';
}

async function getGrantedTree(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.downloadsTreeUri);
}

/**
 * Return a usable, still-permitted tree uri, requesting one from the user if we
 * don't have a valid grant yet. Throws {@link SaveCancelledError} if declined.
 */
async function ensureTree(): Promise<string> {
  const saved = await getGrantedTree();
  if (saved) {
    try {
      // Verify the grant is still valid (revoked/cleared grants throw here).
      await SAF.readDirectoryAsync(saved);
      return saved;
    } catch {
      await AsyncStorage.removeItem(KEYS.downloadsTreeUri);
    }
  }
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) throw new SaveCancelledError();
  await AsyncStorage.setItem(KEYS.downloadsTreeUri, perm.directoryUri);
  return perm.directoryUri;
}

export async function saveToDownloads(
  cacheFileUri: string,
  filename: string,
): Promise<SavedArtifact> {
  if (Platform.OS !== 'android') {
    // iOS has no SAF; callers fall back to sharing. Kept explicit for safety.
    throw new Error('Public Downloads save is Android-only');
  }

  const treeUri = await ensureTree();

  const existing = await SAF.readDirectoryAsync(treeUri);
  const existingNames = new Set(existing.map(displayNameFromUri));
  const finalName = await resolveCollision(filename, (name) => existingNames.has(name));

  const base64 = await FileSystem.readAsStringAsync(cacheFileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // SAF's createFileAsync wants the name WITHOUT the extension it derives from
  // the mime type; passing the full name keeps a clean ".pdf".
  const stem = finalName.replace(/\.pdf$/i, '');
  const fileUri = await SAF.createFileAsync(treeUri, stem, 'application/pdf');
  await SAF.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { uri: fileUri, filename: finalName, location: locationLabel(treeUri) };
}

/** Forget the saved destination so the next export re-prompts for a folder. */
export async function resetDownloadsLocation(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.downloadsTreeUri);
}

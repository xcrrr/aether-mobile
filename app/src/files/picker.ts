import { showPermissionExplanation } from '@/permissions/explanations';

/** A raw picked file, before processing. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

export class PermissionDeniedError extends Error {}

type ImagePickerAsset = import('expo-image-picker').ImagePickerAsset;

function nameFromUri(uri: string, fallback: string): string {
  const tail = uri.split('/').pop() ?? '';
  const clean = tail.split('?')[0];
  return clean || fallback;
}

/** Take a photo with the camera. Returns null if the user cancels. */
export async function pickFromCamera(): Promise<PickedFile | null> {
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const existing = await ImagePicker.getCameraPermissionsAsync();
  let perm = existing;
  if (!existing.granted) {
    if (!(await showPermissionExplanation('camera'))) {
      throw new PermissionDeniedError('Camera was not opened.');
    }
    perm = await ImagePicker.requestCameraPermissionsAsync();
  }
  if (!perm.granted) {
    throw new PermissionDeniedError(
      'Camera access is required. Grant it in Settings.',
    );
  }
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
  });
  if (res.canceled || !res.assets[0]) return null;
  return assetToFile(res.assets[0]);
}

/** Pick one image from the library. Returns null if the user cancels. */
export async function pickFromLibrary(): Promise<PickedFile | null> {
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  let perm = existing;
  if (!existing.granted) {
    if (!(await showPermissionExplanation('photo-library'))) {
      throw new PermissionDeniedError('Photo library was not opened.');
    }
    perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  }
  if (!perm.granted) {
    throw new PermissionDeniedError(
      'Photo access is required. Grant it in Settings.',
    );
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: false,
    quality: 0.9,
  });
  if (res.canceled || !res.assets[0]) return null;
  return assetToFile(res.assets[0]);
}

/** Pick any document. Returns null if the user cancels. */
export async function pickDocument(): Promise<PickedFile | null> {
  const DocumentPicker = require('expo-document-picker') as typeof import('expo-document-picker');
  if (!(await showPermissionExplanation('files'))) return null;
  const res = await DocumentPicker.getDocumentAsync({
    multiple: false,
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.name || nameFromUri(a.uri, 'document'),
    mimeType: a.mimeType || 'application/octet-stream',
  };
}

/** Whether the clipboard currently holds an image. */
export async function clipboardHasImage(): Promise<boolean> {
  try {
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    return await Clipboard.hasImageAsync();
  } catch {
    return false;
  }
}

/**
 * Read an image off the clipboard and persist it to a temp data URI usable
 * by the picker pipeline. Returns null when the clipboard has no image.
 */
export async function pasteImageFromClipboard(): Promise<PickedFile | null> {
  const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
  const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
  const img = await Clipboard.getImageAsync({ format: 'png' });
  if (!img?.data) return null;
  const base64 = img.data.replace(/^data:image\/\w+;base64,/, '');
  const path = `${FileSystem.cacheDirectory}pasted-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri: path, name: `pasted-${Date.now()}.png`, mimeType: 'image/png' };
}

function assetToFile(asset: ImagePickerAsset): PickedFile {
  const mime =
    asset.mimeType ??
    (asset.fileName?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  return {
    uri: asset.uri,
    name: asset.fileName || nameFromUri(asset.uri, `image-${Date.now()}.jpg`),
    mimeType: mime,
  };
}

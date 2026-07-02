import { PermissionsAndroid, Platform } from 'react-native';
import { showPermissionExplanation } from '@/permissions/explanations';

/**
 * Request the microphone (RECORD_AUDIO) permission at the point of first use.
 * Resolves `true` when granted. On non-Android platforms the OS handles the
 * prompt natively, so we optimistically return `true`.
 */
export async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    if (already) return true;
    if (!(await showPermissionExplanation('microphone'))) return false;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone access',
        message: 'Aether needs your microphone for voice input.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

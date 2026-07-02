import { Alert } from 'react-native';

export type PermissionPurpose = 'microphone' | 'camera' | 'photo-library' | 'files' | 'notifications';

export interface PermissionExplanation {
  title: string;
  message: string;
}

export const PERMISSION_EXPLANATIONS: Record<PermissionPurpose, PermissionExplanation> = {
  microphone: {
    title: 'Voice input',
    message: 'Aether uses the microphone only when you tap Voice so it can turn speech into text for the current message.',
  },
  camera: {
    title: 'Camera attachment',
    message: 'Aether opens the camera only when you choose Camera so the photo can be attached to this conversation.',
  },
  'photo-library': {
    title: 'Photo attachment',
    message: 'Aether opens your photo library only when you choose Library so you can attach one image to this conversation.',
  },
  files: {
    title: 'File attachment',
    message: 'Aether opens the system file picker only when you choose Files. Supported documents are read locally for conversation context.',
  },
  notifications: {
    title: 'Model download notification',
    message: 'Android requires a visible notification for long-running model downloads. Aether asks only when you start a download.',
  },
};

export function getPermissionExplanation(purpose: PermissionPurpose): PermissionExplanation {
  return PERMISSION_EXPLANATIONS[purpose];
}

export function showPermissionExplanation(purpose: PermissionPurpose): Promise<boolean> {
  const copy = getPermissionExplanation(purpose);
  return new Promise((resolve) => {
    Alert.alert(copy.title, copy.message, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}


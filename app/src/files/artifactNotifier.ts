import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';

/**
 * System-bar notifications for artifact PDF export — the same "it's happening in
 * the tray" experience as model downloads, but for a locally generated file.
 *
 * Progress notifications are ongoing/indeterminate (no fake percentage — PDF
 * render + save is fast and has no meaningful byte progress). Completion posts a
 * dismissible notification with an "Open" action; tapping either the action or
 * the notification opens the PDF via the share/open-with sheet.
 *
 * All calls are best-effort: if the OS denies notifications, or the native
 * module is unavailable, these no-op and the in-app export UI still surfaces
 * every state (see useExportStore).
 */

const CHANNEL_ID = 'artifact-export';
const CATEGORY_ID = 'artifact-ready';
const OPEN_ACTION = 'open-pdf';

let configured = false;

export function notificationIdFor(artifactId: string): string {
  return `artifact-export-${artifactId}`;
}

async function configureOnce(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Artifact downloads',
        importance: Notifications.AndroidImportance.DEFAULT,
        showBadge: false,
      });
    }
    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      { identifier: OPEN_ACTION, buttonTitle: 'Open', options: { opensAppToForeground: true } },
    ]);
  } catch {
    // Native module missing (e.g. not rebuilt yet) — notifications simply off.
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

async function present(id: string, content: Notifications.NotificationContentInput): Promise<void> {
  await configureOnce();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { ...content, ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
      trigger: null,
    });
  } catch {
    // best-effort
  }
}

export async function notifyExportProgress(
  artifactId: string,
  title: string,
  phase: string,
): Promise<void> {
  await present(notificationIdFor(artifactId), {
    title: 'Preparing PDF',
    body: `${title} — ${phase}`,
    sticky: true,
    autoDismiss: false,
  });
}

export async function notifyExportDone(
  artifactId: string,
  title: string,
  uri: string,
  location: string,
): Promise<void> {
  await present(notificationIdFor(artifactId), {
    title: 'PDF ready',
    body: `${title} was saved to ${location}.`,
    categoryIdentifier: CATEGORY_ID,
    data: { uri },
    sticky: false,
    autoDismiss: true,
  });
}

export async function notifyExportFailed(artifactId: string, title: string): Promise<void> {
  await present(notificationIdFor(artifactId), {
    title: "Couldn't save the PDF",
    body: `${title} wasn't saved. Try again.`,
    sticky: false,
    autoDismiss: true,
  });
}

export async function clearExportNotification(artifactId: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(notificationIdFor(artifactId));
  } catch {
    // ignore
  }
}

/** Open a saved PDF through the platform open-with / share sheet. */
export async function openPdf(uri: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Open PDF',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Register the response listener that opens the PDF when the user taps the
 * notification or its "Open" action. Returns an unsubscribe function. Call once
 * at app start.
 */
export function registerNotificationOpenHandler(): () => void {
  void configureOnce();
  let sub: { remove: () => void } | null = null;
  try {
    sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const uri = response.notification.request.content.data?.uri;
      if (typeof uri === 'string' && uri) void openPdf(uri);
    });
  } catch {
    sub = null;
  }
  return () => sub?.remove();
}

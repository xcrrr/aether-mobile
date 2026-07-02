import { Platform, PermissionsAndroid } from 'react-native';
import * as FileSystem from 'expo-file-system';
import type { DownloadTask } from '@kesha-antonov/react-native-background-downloader';
import { ModelDef } from '@/types';
import { showPermissionExplanation } from '@/permissions/explanations';
import { MODELS, getModelById } from './registry';
import { modelsDir, modelDestPath, stripFileUri, isVerifiedSize } from './paths';

/**
 * Model downloads use @kesha-antonov/react-native-background-downloader: a
 * native, OS-managed download that keeps running with the screen off and the
 * app backgrounded (foreground service on Android < 14, User-Initiated Data
 * Transfer job on Android 14+). It follows the HuggingFace `/resolve/` redirect
 * and runs over Wi-Fi or mobile data.
 *
 * Android 14+ UIDT jobs REQUIRE a notification to run, which needs the
 * POST_NOTIFICATIONS runtime permission (Android 13+). We declare it in the
 * manifest, request it before the first download, and enable the library's
 * progress notification — without this the job silently never starts (0%).
 */

const DOC = FileSystem.documentDirectory ?? 'file:///';
const DIR = modelsDir(DOC);

const active = new Map<string, DownloadTask>();
const speed = new Map<string, { bytes: number; time: number; mbps: number }>();

type DownloaderModule = typeof import('@kesha-antonov/react-native-background-downloader');
let downloaderConfigured = false;

function getDownloader(): DownloaderModule {
  const mod = require('@kesha-antonov/react-native-background-downloader') as DownloaderModule;
  if (!downloaderConfigured) {
    // UIDT jobs (Android 14+) must be backed by a visible notification.
    mod.setConfig({ showNotificationsEnabled: true });
    downloaderConfigured = true;
  }
  return mod;
}

export async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(`file://${DIR}`);
  if (!info.exists) await FileSystem.makeDirectoryAsync(`file://${DIR}`, { intermediates: true });
}

/** Plain filesystem path (no file://) — what LiteRT and the downloader expect. */
export function localPath(model: ModelDef): string {
  return modelDestPath(DOC, model.filename);
}

export async function isInstalled(model: ModelDef): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(`file://${localPath(model)}`, { size: true });
  if (!info.exists) return false;
  return isVerifiedSize((info as { size?: number }).size ?? 0, model.sizeBytes);
}


export async function freeBytes(): Promise<number> {
  return FileSystem.getFreeDiskStorageAsync();
}

export async function totalBytes(): Promise<number> {
  return FileSystem.getTotalDiskCapacityAsync();
}

export async function installedBytes(): Promise<number> {
  let sum = 0;
  for (const m of MODELS) {
    const info = await FileSystem.getInfoAsync(`file://${localPath(m)}`, { size: true });
    if (info.exists) sum += (info as { size?: number }).size ?? 0;
  }
  return sum;
}

/**
 * Android 13+ gates notifications behind a runtime permission. The UIDT
 * download job can't post its mandatory notification without it (download
 * silently stays at 0%). Request it before downloading.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (!perm) return true;
  if (await PermissionsAndroid.check(perm)) return true;
  if (!(await showPermissionExplanation('notifications'))) return false;
  const result = await PermissionsAndroid.request(perm);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export interface DownloadHandlers {
  onProgress: (pct: number, downloaded: number, total: number, mbps: number) => void;
  onDone: (path: string) => void;
  onError: (msg: string) => void;
}

export async function startDownload(model: ModelDef, h: DownloadHandlers): Promise<void> {
  if (active.has(model.id)) return;
  if (!(await ensureNotificationPermission())) {
    h.onError('Notification permission is required for model downloads on this Android version.');
    return;
  }
  await ensureDir();
  const dest = localPath(model);
  speed.set(model.id, { bytes: 0, time: Date.now(), mbps: 0 });
  const { createDownloadTask } = getDownloader();

  const task = createDownloadTask({
    id: model.id,
    url: model.downloadUrl,
    destination: dest,
    isAllowedOverRoaming: true,
    isAllowedOverMetered: true,
    metadata: { filename: model.filename },
  });
  active.set(model.id, task);

  task
    .begin(({ expectedBytes }) => h.onProgress(0, 0, expectedBytes, 0))
    .progress(({ bytesDownloaded, bytesTotal }) => {
      const total = bytesTotal > 0 ? bytesTotal : model.sizeBytes;
      const pct = total > 0 ? (bytesDownloaded / total) * 100 : 0;
      const t = speed.get(model.id);
      let mbps = 0;
      if (t) {
        const now = Date.now();
        const elapsed = (now - t.time) / 1000;
        if (elapsed >= 0.5) {
          const inst = (bytesDownloaded - t.bytes) / elapsed / 1e6;
          mbps = Math.max(0, t.mbps * 0.7 + inst * 0.3);
          speed.set(model.id, { bytes: bytesDownloaded, time: now, mbps });
        } else {
          mbps = t.mbps;
        }
      }
      h.onProgress(pct, bytesDownloaded, total, mbps);
    })
    .done(({ location }) => {
      active.delete(model.id);
      speed.delete(model.id);
      h.onDone(stripFileUri(location || dest));
    })
    .error(({ error }) => {
      active.delete(model.id);
      speed.delete(model.id);
      const msg = typeof error === 'string' ? error : 'Download failed';
      if (!/cancel|stopped/i.test(msg)) h.onError(msg);
    });

  task.start();
}

export function cancelDownload(id: string): void {
  active.get(id)?.stop();
  active.delete(id);
  speed.delete(id);
}

export async function deleteModel(model: ModelDef): Promise<void> {
  const uri = `file://${localPath(model)}`;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
}

/** Reattach handlers to downloads that ran while the app was closed/backgrounded. */
export async function reattachDownloads(
  onProgress: (id: string, pct: number) => void,
  onDone: (id: string, path: string) => void,
): Promise<void> {
  try {
    const { getExistingDownloadTasks } = getDownloader();
    for (const task of await getExistingDownloadTasks()) {
      const id = task.id;
      const model = getModelById(id);
      if (!model) continue;
      if (task.state === 'DONE') {
        onDone(id, stripFileUri(task.destination || localPath(model)));
        continue;
      }
      active.set(id, task);
      task
        .progress(({ bytesDownloaded, bytesTotal }) =>
          onProgress(id, bytesTotal > 0 ? (bytesDownloaded / bytesTotal) * 100 : 0))
        .done(({ location }) => {
          active.delete(id);
          onDone(id, stripFileUri(location || localPath(model)));
        })
        .error(() => active.delete(id));
    }
  } catch (e) {
    console.error('[ModelManager] reattach error', e);
  }
}

import { Platform, PermissionsAndroid } from 'react-native';
import * as FileSystem from 'expo-file-system';
import {
  createDownloadTask, getExistingDownloadTasks, setConfig,
} from '@kesha-antonov/react-native-background-downloader';
import type { DownloadTask } from '@kesha-antonov/react-native-background-downloader';
import { ModelDef } from '@/types';
import { MODELS, getModelById } from './registry';
import { modelsDir, modelDestPath, stripFileUri, isVerifiedSize } from './paths';
import { isMmprojFileValid } from './ggufCheck';
import { base64ToArrayBuffer } from '@/files/base64';

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

// UIDT jobs (Android 14+) must be backed by a visible notification.
setConfig({ showNotificationsEnabled: true });

export async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(`file://${DIR}`);
  if (!info.exists) await FileSystem.makeDirectoryAsync(`file://${DIR}`, { intermediates: true });
}

/** Plain filesystem path (no file://) — what llama.rn and the downloader expect. */
export function localPath(model: ModelDef): string {
  return modelDestPath(DOC, model.filename);
}

export async function isInstalled(model: ModelDef): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(`file://${localPath(model)}`, { size: true });
  if (!info.exists) return false;
  return isVerifiedSize((info as { size?: number }).size ?? 0, model.sizeBytes);
}

/** On-disk path for the model's multimodal projector ("vision pack"). */
export function mmprojLocalPath(model: ModelDef): string | null {
  return model.mmprojFilename ? modelDestPath(DOC, model.mmprojFilename) : null;
}

/** Whether the model's vision pack is fully downloaded and size-verified. */
export async function isMmprojInstalled(model: ModelDef): Promise<boolean> {
  const path = mmprojLocalPath(model);
  if (!path || !model.mmprojSizeBytes) return false;
  const info = await FileSystem.getInfoAsync(`file://${path}`, { size: true });
  if (!info.exists) return false;
  return isVerifiedSize((info as { size?: number }).size ?? 0, model.mmprojSizeBytes);
}

export interface MmprojIntegrity { ok: boolean; reason?: 'missing' | 'corrupt'; }

/** Verify a downloaded vision pack: present, GGUF magic, size within tolerance.
 *  Deletes a corrupt file so the UI can prompt a clean re-download. */
export async function verifyMmprojIntegrity(model: ModelDef): Promise<MmprojIntegrity> {
  const path = mmprojLocalPath(model);
  if (!path || !model.mmprojSizeBytes) return { ok: false, reason: 'missing' };
  const uri = `file://${path}`;
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) return { ok: false, reason: 'missing' };
  const size = (info as { size?: number }).size ?? 0;

  // Read the file's leading bytes via base64; decode only the first 4 to ASCII.
  let headStr = '';
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType?.Base64,
      length: 8,
      position: 0,
    });
    const bytes = new Uint8Array(base64ToArrayBuffer(b64)).slice(0, 4);
    headStr = String.fromCharCode(...bytes);
  } catch {
    headStr = '';
  }

  const valid = isMmprojFileValid({ headStr, sizeBytes: size, expectedBytes: model.mmprojSizeBytes });
  if (!valid) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    return { ok: false, reason: 'corrupt' };
  }
  return { ok: true };
}

/** Download the model's vision pack (mmproj) using the same background downloader. */
export async function startMmprojDownload(model: ModelDef, h: DownloadHandlers): Promise<void> {
  const dest = mmprojLocalPath(model);
  if (!dest || !model.mmprojUrl) return h.onError('No vision pack for this model.');
  const taskId = `${model.id}.mmproj`;
  if (active.has(taskId)) return;
  await ensureNotificationPermission();
  await ensureDir();
  speed.set(taskId, { bytes: 0, time: Date.now(), mbps: 0 });

  const task = createDownloadTask({
    id: taskId,
    url: model.mmprojUrl,
    destination: dest,
    isAllowedOverRoaming: true,
    isAllowedOverMetered: true,
    metadata: { filename: model.mmprojFilename },
  });
  active.set(taskId, task);

  const total0 = model.mmprojSizeBytes ?? 0;
  task
    .begin(({ expectedBytes }) => h.onProgress(0, 0, expectedBytes || total0, 0))
    .progress(({ bytesDownloaded, bytesTotal }) => {
      const total = bytesTotal > 0 ? bytesTotal : total0;
      const pct = total > 0 ? (bytesDownloaded / total) * 100 : 0;
      const t = speed.get(taskId);
      let mbps = 0;
      if (t) {
        const now = Date.now();
        const elapsed = (now - t.time) / 1000;
        if (elapsed >= 0.5) {
          const inst = (bytesDownloaded - t.bytes) / elapsed / 1e6;
          mbps = Math.max(0, t.mbps * 0.7 + inst * 0.3);
          speed.set(taskId, { bytes: bytesDownloaded, time: now, mbps });
        } else {
          mbps = t.mbps;
        }
      }
      h.onProgress(pct, bytesDownloaded, total, mbps);
    })
    .done(({ location }) => {
      active.delete(taskId);
      speed.delete(taskId);
      h.onDone(stripFileUri(location || dest));
    })
    .error(({ error }) => {
      active.delete(taskId);
      speed.delete(taskId);
      const msg = typeof error === 'string' ? error : 'Download failed';
      if (!/cancel|stopped/i.test(msg)) h.onError(msg);
    });

  task.start();
}

export function cancelMmprojDownload(model: ModelDef): void {
  const taskId = `${model.id}.mmproj`;
  active.get(taskId)?.stop();
  active.delete(taskId);
  speed.delete(taskId);
}

export async function deleteMmproj(model: ModelDef): Promise<void> {
  const path = mmprojLocalPath(model);
  if (!path) return;
  const uri = `file://${path}`;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
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
  await ensureNotificationPermission();
  await ensureDir();
  const dest = localPath(model);
  speed.set(model.id, { bytes: 0, time: Date.now(), mbps: 0 });

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

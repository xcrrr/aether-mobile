import * as FileSystem from 'expo-file-system';
import {
  createDownloadTask, getExistingDownloadTasks,
} from '@kesha-antonov/react-native-background-downloader';
import type { DownloadTask } from '@kesha-antonov/react-native-background-downloader';
import { ModelDef } from '@/types';
import { MODELS, getModelById } from './registry';
import { modelsDir, modelDestPath, stripFileUri, isVerifiedSize } from './paths';

const DOC = FileSystem.documentDirectory ?? 'file:///';
const DIR = modelsDir(DOC);

const active = new Map<string, DownloadTask>();
const speed = new Map<string, { bytes: number; time: number; mbps: number }>();

export async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(`file://${DIR}`);
  if (!info.exists) await FileSystem.makeDirectoryAsync(`file://${DIR}`, { intermediates: true });
}

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

export interface DownloadHandlers {
  onProgress: (pct: number, downloaded: number, total: number, mbps: number) => void;
  onDone: (path: string) => void;
  onError: (msg: string) => void;
}

export async function startDownload(model: ModelDef, h: DownloadHandlers): Promise<void> {
  if (active.has(model.id)) return;
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
      const pct = bytesTotal > 0 ? (bytesDownloaded / bytesTotal) * 100 : 0;
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
      h.onProgress(pct, bytesDownloaded, bytesTotal, mbps);
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

/** Reattach handlers to downloads that ran while the app was closed. */
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

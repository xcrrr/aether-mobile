import * as FileSystem from 'expo-file-system';
import { renderArtifactPdf } from './pdfExporter';
import { buildArtifactFilename } from './artifactFilename';
import { saveToDownloads, SaveCancelledError } from './saveToDownloads';
import {
  ensureNotificationPermission,
  notifyExportProgress,
  notifyExportDone,
  notifyExportFailed,
  clearExportNotification,
  openPdf,
} from './artifactNotifier';

/**
 * The single, centralized artifact -> PDF export pipeline. Every download
 * surface (Aether Actions results, kept/Library artifacts, and any future
 * chat-attached artifact) routes through {@link exportArtifactPdf}. There is no
 * per-surface download logic and no per-format branching: the one user-facing
 * output is always a real PDF.
 *
 * Flow: render Markdown -> real PDF (cache) -> save into the public Downloads
 * collection (SAF, scoped, no broad permission) -> post completion notification
 * with an Open action -> clean up the cache copy.
 */

export type ExportPhase = 'preparing' | 'saving' | 'done' | 'failed' | 'cancelled';

export interface ExportInput {
  /** Stable id used to de-duplicate concurrent exports and key the notification. */
  id: string;
  title: string;
  content: string;
}

export interface ExportResult {
  ok: boolean;
  uri?: string;
  filename?: string;
  location?: string;
  cancelled?: boolean;
  error?: string;
}

export interface ExportCallbacks {
  onPhase?: (phase: ExportPhase) => void;
}

const inFlight = new Set<string>();

async function cleanupCache(uri: string | null): Promise<void> {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // best-effort; OS clears the cache dir anyway
  }
}

export function isExporting(id: string): boolean {
  return inFlight.has(id);
}

export async function exportArtifactPdf(
  input: ExportInput,
  cb: ExportCallbacks = {},
): Promise<ExportResult> {
  const { id, title } = input;
  if (inFlight.has(id)) {
    return { ok: false, error: 'Already exporting this artifact' };
  }
  inFlight.add(id);

  const phase = (p: ExportPhase) => cb.onPhase?.(p);
  let cacheUri: string | null = null;

  try {
    // Request (best-effort) so the tray notification can appear; the export
    // still completes and shows in-app state even if this is denied.
    void ensureNotificationPermission();

    phase('preparing');
    void notifyExportProgress(id, title, 'Preparing PDF…');
    cacheUri = await renderArtifactPdf(input);

    const info = await FileSystem.getInfoAsync(cacheUri, { size: true });
    if (!info.exists || ((info as { size?: number }).size ?? 0) === 0) {
      throw new Error('PDF generation produced an empty file');
    }

    phase('saving');
    void notifyExportProgress(id, title, 'Saving PDF…');
    const filename = buildArtifactFilename(title);
    const saved = await saveToDownloads(cacheUri, filename);

    phase('done');
    void notifyExportDone(id, title, saved.uri, saved.location);
    await cleanupCache(cacheUri);
    return { ok: true, uri: saved.uri, filename: saved.filename, location: saved.location };
  } catch (e) {
    await cleanupCache(cacheUri);
    if (e instanceof SaveCancelledError) {
      phase('cancelled');
      void clearExportNotification(id);
      return { ok: false, cancelled: true };
    }
    phase('failed');
    void notifyExportFailed(id, title);
    const error = e instanceof Error ? e.message : 'Export failed';
    return { ok: false, error };
  } finally {
    inFlight.delete(id);
  }
}

export { openPdf };

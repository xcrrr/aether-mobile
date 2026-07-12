import type { ExportPhase } from './ArtifactExporter';

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 4096 })),
  deleteAsync: jest.fn(async () => {}),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('./pdfExporter', () => ({
  renderArtifactPdf: jest.fn(async () => 'file:///cache/out.pdf'),
}));

class MockSaveCancelledError extends Error {}
jest.mock('./saveToDownloads', () => ({
  saveToDownloads: jest.fn(async () => ({
    uri: 'content://downloads/doc',
    filename: 'Aether - T - 2026-07-05.pdf',
    location: 'Downloads',
  })),
  SaveCancelledError: MockSaveCancelledError,
}));

jest.mock('./artifactNotifier', () => ({
  ensureNotificationPermission: jest.fn(async () => true),
  notifyExportProgress: jest.fn(async () => {}),
  notifyExportDone: jest.fn(async () => {}),
  notifyExportFailed: jest.fn(async () => {}),
  clearExportNotification: jest.fn(async () => {}),
  openPdf: jest.fn(async () => true),
}));

const FileSystem = require('expo-file-system');
const { renderArtifactPdf } = require('./pdfExporter');
const { saveToDownloads } = require('./saveToDownloads');
const notifier = require('./artifactNotifier');
const { exportArtifactPdf } = require('./ArtifactExporter');

const input = { id: 'a1', title: 'T', content: '# Hello' };

beforeEach(() => {
  jest.clearAllMocks();
  FileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 4096 });
  renderArtifactPdf.mockResolvedValue('file:///cache/out.pdf');
  saveToDownloads.mockResolvedValue({
    uri: 'content://downloads/doc',
    filename: 'Aether - T - 2026-07-05.pdf',
    location: 'Downloads',
  });
});

describe('exportArtifactPdf', () => {
  it('runs the happy path and cleans up the cache file', async () => {
    const phases: ExportPhase[] = [];
    const res = await exportArtifactPdf(input, { onPhase: (p: ExportPhase) => phases.push(p) });

    expect(res).toEqual({
      ok: true,
      uri: 'content://downloads/doc',
      filename: 'Aether - T - 2026-07-05.pdf',
      location: 'Downloads',
    });
    expect(phases).toEqual(['preparing', 'saving', 'done']);
    expect(notifier.notifyExportDone).toHaveBeenCalledWith('a1', 'T', 'content://downloads/doc', 'Downloads');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/out.pdf', { idempotent: true });
  });

  it('fails when the generated PDF is empty', async () => {
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 0 });
    const res = await exportArtifactPdf({ ...input, id: 'a2' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/empty/i);
    expect(notifier.notifyExportFailed).toHaveBeenCalled();
    expect(saveToDownloads).not.toHaveBeenCalled();
  });

  it('reports cancellation when the user declines the save folder', async () => {
    saveToDownloads.mockRejectedValue(new MockSaveCancelledError('declined'));
    const res = await exportArtifactPdf({ ...input, id: 'a3' });
    expect(res).toEqual({ ok: false, cancelled: true });
    expect(notifier.notifyExportFailed).not.toHaveBeenCalled();
    expect(notifier.clearExportNotification).toHaveBeenCalledWith('a3');
  });

  it('surfaces a plain error on save failure', async () => {
    saveToDownloads.mockRejectedValue(new Error('disk full'));
    const res = await exportArtifactPdf({ ...input, id: 'a4' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('disk full');
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });

  it('de-duplicates concurrent exports of the same artifact', async () => {
    let resolveSave: (v: unknown) => void = () => {};
    const pending = new Promise((r) => { resolveSave = r; });
    saveToDownloads.mockReturnValue(pending);

    const first = exportArtifactPdf({ ...input, id: 'dup' });
    // The in-flight guard is set synchronously, so a second call is rejected
    // immediately regardless of how far the first has progressed.
    const second = await exportArtifactPdf({ ...input, id: 'dup' });
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/already/i);

    resolveSave({ uri: 'content://d', filename: 'f.pdf', location: 'Downloads' });
    const firstResult = await first;
    expect(firstResult.ok).toBe(true);
  });
});

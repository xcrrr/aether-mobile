import { create } from 'zustand';
import { MODELS, DEFAULT_MODEL_ID } from '@/models/registry';
import * as MM from '@/models/ModelManager';
import { loadSettings, saveSettings } from '@/storage/settings';

interface DownloadState { pct: number; mbps: number; downloading: boolean; }
interface ModelState {
  installed: Record<string, boolean>;
  downloads: Record<string, DownloadState>;
  activeModelId: string | null;
  /** Per-model vision pack (mmproj) install state. */
  visionInstalled: Record<string, boolean>;
  visionDownloads: Record<string, DownloadState>;
  hydrate: () => Promise<void>;
  refreshInstalled: () => Promise<void>;
  setActive: (id: string) => Promise<void>;
  download: (id: string) => Promise<void>;
  cancel: (id: string) => void;
  remove: (id: string) => Promise<void>;
  refreshVision: () => Promise<void>;
  downloadVision: (id: string) => Promise<void>;
  cancelVision: (id: string) => void;
  removeVision: (id: string) => Promise<void>;
}

export const useModelStore = create<ModelState>((set, get) => ({
  installed: {},
  downloads: {},
  activeModelId: null,
  visionInstalled: {},
  visionDownloads: {},
  hydrate: async () => {
    const settings = await loadSettings();
    await get().refreshInstalled();
    await get().refreshVision();
    const installed = get().installed;
    const active = settings.activeModelId && installed[settings.activeModelId]
      ? settings.activeModelId
      : (installed[DEFAULT_MODEL_ID] ? DEFAULT_MODEL_ID : null);
    set({ activeModelId: active });
    await MM.reattachDownloads(
      (id, pct) => set((s) => ({ downloads: { ...s.downloads, [id]: { pct, mbps: 0, downloading: true } } })),
      async (id) => {
        await get().refreshInstalled();
        set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 100, mbps: 0, downloading: false } } }));
      },
    );
  },
  refreshInstalled: async () => {
    const entries = await Promise.all(MODELS.map(async (m) => [m.id, await MM.isInstalled(m)] as const));
    set({ installed: Object.fromEntries(entries) });
  },
  setActive: async (id) => { set({ activeModelId: id }); await saveSettings({ activeModelId: id }); },
  download: async (id) => {
    const model = MODELS.find((m) => m.id === id);
    if (!model) return;
    set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 0, mbps: 0, downloading: true } } }));
    await MM.startDownload(model, {
      onProgress: (pct, _d, _t, mbps) =>
        set((s) => ({ downloads: { ...s.downloads, [id]: { pct, mbps, downloading: true } } })),
      onDone: async () => {
        await get().refreshInstalled();
        set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 100, mbps: 0, downloading: false } } }));
        if (!get().activeModelId) await get().setActive(id);
      },
      onError: () =>
        set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 0, mbps: 0, downloading: false } } })),
    });
  },
  cancel: (id) => {
    MM.cancelDownload(id);
    set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 0, mbps: 0, downloading: false } } }));
  },
  remove: async (id) => {
    const model = MODELS.find((m) => m.id === id);
    if (!model) return;
    await MM.deleteModel(model);
    await get().refreshInstalled();
    if (get().activeModelId === id) await get().setActive(DEFAULT_MODEL_ID);
  },
  refreshVision: async () => {
    const entries = await Promise.all(
      MODELS.filter((m) => m.mmprojFilename).map(
        async (m) => [m.id, await MM.isMmprojInstalled(m)] as const,
      ),
    );
    set({ visionInstalled: Object.fromEntries(entries) });
  },
  downloadVision: async (id) => {
    const model = MODELS.find((m) => m.id === id);
    if (!model?.mmprojUrl) return;
    set((s) => ({ visionDownloads: { ...s.visionDownloads, [id]: { pct: 0, mbps: 0, downloading: true } } }));
    await MM.startMmprojDownload(model, {
      onProgress: (pct, _d, _t, mbps) =>
        set((s) => ({ visionDownloads: { ...s.visionDownloads, [id]: { pct, mbps, downloading: true } } })),
      onDone: async () => {
        await get().refreshVision();
        set((s) => ({ visionDownloads: { ...s.visionDownloads, [id]: { pct: 100, mbps: 0, downloading: false } } }));
      },
      onError: () =>
        set((s) => ({ visionDownloads: { ...s.visionDownloads, [id]: { pct: 0, mbps: 0, downloading: false } } })),
    });
  },
  cancelVision: (id) => {
    const model = MODELS.find((m) => m.id === id);
    if (model) MM.cancelMmprojDownload(model);
    set((s) => ({ visionDownloads: { ...s.visionDownloads, [id]: { pct: 0, mbps: 0, downloading: false } } }));
  },
  removeVision: async (id) => {
    const model = MODELS.find((m) => m.id === id);
    if (!model) return;
    await MM.deleteMmproj(model);
    await get().refreshVision();
  },
}));

import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { useToast } from '@/state/useToast';
import type { ExportInput, ExportPhase, ExportResult } from '@/files/ArtifactExporter';

/**
 * In-app mirror of artifact export state. This is the always-present feedback
 * channel: even when system notifications are denied or unavailable, every
 * export surface reads its phase from here (matching how useModelStore mirrors
 * model-download progress). System-bar notifications are an additive layer on
 * top, handled inside the pipeline.
 */

export interface ExportEntry {
  phase: ExportPhase;
  uri?: string;
  location?: string;
  error?: string;
}

interface ExportState {
  exports: Record<string, ExportEntry>;
  exportArtifact: (input: ExportInput) => Promise<ExportResult>;
  open: (uri: string) => void;
  clear: (id: string) => void;
}

type ExporterModule = typeof import('@/files/ArtifactExporter');

function getExporter(): ExporterModule {
  return require('@/files/ArtifactExporter') as ExporterModule;
}

export const useExportStore = create<ExportState>((set, get) => ({
  exports: {},
  open: (uri) => {
    void getExporter().openPdf(uri);
  },
  clear: (id) =>
    set((s) => {
      const next = { ...s.exports };
      delete next[id];
      return { exports: next };
    }),
  exportArtifact: async (input) => {
    if (get().exports[input.id]?.phase === 'preparing' || get().exports[input.id]?.phase === 'saving') {
      return { ok: false, error: 'Already exporting this artifact' };
    }
    const setPhase = (phase: ExportPhase) =>
      set((s) => ({ exports: { ...s.exports, [input.id]: { ...s.exports[input.id], phase } } }));

    setPhase('preparing');
    const { exportArtifactPdf } = getExporter();
    const result = await exportArtifactPdf(input, { onPhase: setPhase });

    const toast = useToast.getState().show;
    if (result.ok) {
      set((s) => ({
        exports: {
          ...s.exports,
          [input.id]: { phase: 'done', uri: result.uri, location: result.location },
        },
      }));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`PDF ready · saved to ${result.location ?? 'Downloads'}`);
    } else if (result.cancelled) {
      get().clear(input.id);
    } else {
      set((s) => ({
        exports: { ...s.exports, [input.id]: { phase: 'failed', error: result.error } },
      }));
      toast("Couldn't save the PDF. Try again.");
    }
    return result;
  },
}));

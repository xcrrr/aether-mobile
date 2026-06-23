export interface VisionFlags {
  supported: boolean;
  installed: boolean;
  ready: boolean;          // initMultimodal succeeded + isMultimodalEnabled true
  selfTestPassed: boolean; // a real image actually decoded
  error: string | null;
}

export type VisionStatusKind =
  | 'unsupported' | 'not_downloaded' | 'verifying' | 'working' | 'error';

export interface VisionStatus { kind: VisionStatusKind; detail?: string; }

export function deriveVisionStatus(f: VisionFlags): VisionStatus {
  if (!f.supported) return { kind: 'unsupported' };
  if (!f.installed) return { kind: 'not_downloaded' };
  if (!f.ready) return { kind: 'error', detail: f.error ?? 'Vision unavailable on this device.' };
  if (!f.selfTestPassed) {
    return f.error ? { kind: 'error', detail: f.error } : { kind: 'verifying' };
  }
  return { kind: 'working' };
}

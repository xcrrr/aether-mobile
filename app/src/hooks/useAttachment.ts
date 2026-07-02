import { useCallback, useState } from 'react';
import { FileAttachment } from '@/types';
import {
  pickFromCamera,
  pickFromLibrary,
  pickDocument,
  pasteImageFromClipboard,
  PermissionDeniedError,
  type PickedFile,
} from '@/files/picker';

export interface AttachmentState {
  attachment: FileAttachment | null;
  processing: boolean;
  error: string | null;
  pickCamera: () => Promise<void>;
  pickLibrary: () => Promise<void>;
  pickFiles: () => Promise<void>;
  paste: () => Promise<void>;
  remove: () => void;
  clearError: () => void;
}

/** Owns the single in-progress attachment: picking, processing, and errors. */
export function useAttachment(): AttachmentState {
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (pick: () => Promise<PickedFile | null>) => {
    setError(null);
    let picked: PickedFile | null;
    try {
      picked = await pick();
    } catch (e) {
      setError(
        e instanceof PermissionDeniedError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not open the picker.',
      );
      return;
    }
    if (!picked) return; // user cancelled

    setProcessing(true);
    setAttachment(null);
    try {
      const { fileProcessor } = require('@/files/FileProcessor') as typeof import('@/files/FileProcessor');
      const result = await fileProcessor.processFile(picked.uri, picked.mimeType, picked.name);
      setAttachment(result);
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'FileProcessorError'
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not process the file.',
      );
    } finally {
      setProcessing(false);
    }
  }, []);

  const pickCamera = useCallback(() => run(pickFromCamera), [run]);
  const pickLibrary = useCallback(() => run(pickFromLibrary), [run]);
  const pickFiles = useCallback(() => run(pickDocument), [run]);
  const paste = useCallback(() => run(pasteImageFromClipboard), [run]);
  const remove = useCallback(() => {
    setAttachment(null);
    setError(null);
  }, []);
  const clearError = useCallback(() => setError(null), []);

  return { attachment, processing, error, pickCamera, pickLibrary, pickFiles, paste, remove, clearError };
}

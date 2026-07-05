import * as FileSystem from 'expo-file-system';
import mammoth from 'mammoth';
import { FileAttachment, AttachmentType } from '@/types';
import { extractPdfText } from './pdf';
import { base64ToArrayBuffer } from './base64';

const uid = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
// PDF/DOCX are read fully into a JS string (base64, then inflated/unzipped) before
// any bound kicks in — an unbounded file risks OOM on-device well before MAX_CHARS
// ever gets a chance to trim the result. Same ceiling as images: large enough for
// any real document, small enough to fail fast on the rest.
const MAX_DOC_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_TEXT_CHARS = 8000;
const TRUNCATION_NOTE = '\n\n(document truncated for context)';

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const TEXT_EXT = new Set(['txt', 'md', 'csv', 'json', 'xml']);
/** Selectable but explicitly unsupported — surfaced as a friendly error. */
const REJECTED_EXT = new Set(['xls', 'xlsx', 'ppt', 'pptx', 'mp3', 'wav', 'm4a', 'mp4', 'mov', 'avi']);

const extOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

function classify(name: string, mimeType: string): AttachmentType | 'rejected' | null {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext) || mimeType.startsWith('image/')) return 'image';
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (ext === 'docx' || mimeType.includes('officedocument.wordprocessing')) return 'docx';
  if (TEXT_EXT.has(ext) || mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';
  if (REJECTED_EXT.has(ext)) return 'rejected';
  return null;
}

function truncate(text: string): string {
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) + TRUNCATION_NOTE : text;
}

export class FileProcessorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileProcessorError';
  }
}

/**
 * Turn a picked file URI into a fully-processed {@link FileAttachment}:
 * images carry their base64, documents carry extracted text. Unsupported
 * types raise {@link FileProcessorError} with a user-facing message.
 */
export class FileProcessor {
  async processFile(uri: string, mimeType: string, name: string): Promise<FileAttachment> {
    const kind = classify(name, mimeType);
    if (kind === 'rejected' || kind === null) {
      throw new FileProcessorError("This file type isn't supported yet.");
    }

    const info = await FileSystem.getInfoAsync(uri, { size: true });
    const sizeBytes = info.exists && 'size' in info ? info.size : 0;

    const base: FileAttachment = { id: uid(), uri, name, type: kind, mimeType, sizeBytes };

    switch (kind) {
      case 'image':
        return this.processImage(base);
      case 'pdf':
        return this.processPdf(base);
      case 'docx':
        return this.processDocx(base);
      case 'text':
        return this.processText(base);
    }
  }

  private async processImage(a: FileAttachment): Promise<FileAttachment> {
    if (a.sizeBytes > MAX_IMAGE_BYTES) {
      throw new FileProcessorError('Image is too large (max 20 MB).');
    }
    const imageBase64 = await FileSystem.readAsStringAsync(a.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // Picker/camera URIs live in the cache and can be purged by the OS. Copy to
    // a durable location so the image still renders in old conversations after
    // a restart (base64 is stripped from storage; only this uri persists).
    const uri = await this.persistImage(a.uri, a.id);
    return { ...a, uri, imageBase64 };
  }

  /** Copy a picked image into the app's document dir; return its file:// uri. */
  private async persistImage(srcUri: string, id: string): Promise<string> {
    try {
      const dir = `${FileSystem.documentDirectory}chat-media`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const dest = `${dir}/${id}.jpg`;
      await FileSystem.copyAsync({ from: srcUri, to: dest });
      return dest;
    } catch {
      return srcUri; // fall back to the original uri if the copy fails
    }
  }

  private async processText(a: FileAttachment): Promise<FileAttachment> {
    try {
      const raw = await FileSystem.readAsStringAsync(a.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return { ...a, extractedText: truncate(raw) };
    } catch (e) {
      return { ...a, processingError: this.msg(e, 'Could not read this text file.') };
    }
  }

  private async processPdf(a: FileAttachment): Promise<FileAttachment> {
    if (a.sizeBytes > MAX_DOC_BYTES) {
      throw new FileProcessorError('This PDF is too large to read (max 20 MB).');
    }
    try {
      const base64 = await FileSystem.readAsStringAsync(a.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { text, pageCount, encrypted } = extractPdfText(base64);
      if (encrypted) {
        return {
          ...a,
          pageCount,
          processingError: 'This PDF is password-protected. Remove the password and try again.',
        };
      }
      if (!text.trim()) {
        return {
          ...a,
          pageCount,
          processingError:
            "Couldn't read this PDF's text (it may be scanned or image-only). " +
            'Paste the relevant text into the chat instead.',
        };
      }
      return { ...a, extractedText: text, pageCount };
    } catch (e) {
      return { ...a, processingError: this.msg(e, 'Could not read this PDF.') };
    }
  }

  private async processDocx(a: FileAttachment): Promise<FileAttachment> {
    if (a.sizeBytes > MAX_DOC_BYTES) {
      throw new FileProcessorError('This Word document is too large to read (max 20 MB).');
    }
    try {
      const base64 = await FileSystem.readAsStringAsync(a.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = base64ToArrayBuffer(base64);
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      const text = (value ?? '').trim();
      if (!text) {
        return { ...a, processingError: 'This document appears to be empty.' };
      }
      return { ...a, extractedText: truncate(text) };
    } catch (e) {
      return { ...a, processingError: this.msg(e, 'Could not read this Word document.') };
    }
  }

  private msg(e: unknown, fallback: string): string {
    return e instanceof Error && e.message ? e.message : fallback;
  }
}

export const fileProcessor = new FileProcessor();

/** Pretty-print a byte count for chips/cards. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

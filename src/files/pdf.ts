import pako from 'pako';
import { base64ToUint8Array } from './base64';

/**
 * Pure-JS, on-device PDF text extraction.
 *
 * There is no reliable native PDF text extractor for the Expo CNG / React
 * Native runtime, so we parse the raw bytes directly:
 *   1. inflate every FlateDecode content stream with `pako`
 *   2. pull text out of the PDF text-showing operators (`Tj`, `TJ`, `'`, `"`)
 *   3. count `/Type /Page` objects for a page count
 *
 * This handles the large majority of "normal" text PDFs. Scanned/image-only
 * PDFs and exotic encodings yield little or no text — callers must treat an
 * empty result as "couldn't read it" and fall back gracefully.
 */

export interface PdfExtraction {
  text: string;
  pageCount: number;
}

const MAX_PAGES = 50;
const MAX_CHARS = 8000;
const TRUNCATION_NOTE = '\n\n(document truncated for context)';

/** Bytes -> latin1 string (1:1 byte mapping; preserves binary offsets). */
function bytesToLatin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/** Unescape a PDF literal string body (between parentheses). */
function unescapePdfString(s: string): string {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_m, esc: string) => {
    switch (esc) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'b': return '\b';
      case 'f': return '\f';
      case '(': return '(';
      case ')': return ')';
      case '\\': return '\\';
      default: return String.fromCharCode(parseInt(esc, 8) & 0xff);
    }
  });
}

/** Pull visible text from a decoded content stream. */
function textFromContentStream(content: string): string {
  let out = '';
  // Match parenthesised strings followed by a text-showing operator, plus
  // TJ arrays of strings. Handles escaped parens inside the string.
  const re = /\((?:\\.|[^\\()])*\)\s*(?:Tj|TJ|'|")|\[((?:\\.|[^\\\]])*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const token = m[0];
    if (m[1] !== undefined) {
      // TJ array — concatenate each literal string fragment.
      const parts = m[1].match(/\((?:\\.|[^\\()])*\)/g) ?? [];
      for (const p of parts) out += unescapePdfString(p.slice(1, -1));
      out += ' ';
    } else {
      const body = token.slice(1, token.lastIndexOf(')'));
      out += unescapePdfString(body);
      out += token.includes("'") || token.includes('"') ? '\n' : ' ';
    }
  }
  return out;
}

export function extractPdfText(base64: string): PdfExtraction {
  const bytes = base64ToUint8Array(base64);
  const raw = bytesToLatin1(bytes);

  const pageCount = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length || 0;

  let collected = '';
  let pagesProcessed = 0;
  const streamRe = /stream\r?\n/g;
  let sm: RegExpExecArray | null;

  while ((sm = streamRe.exec(raw)) !== null && pagesProcessed < MAX_PAGES) {
    const start = sm.index + sm[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;

    // Inspect the object dict preceding the stream to detect compression.
    const header = raw.slice(Math.max(0, sm.index - 400), sm.index);
    const isFlate = /\/Filter\s*(?:\/FlateDecode|\[\s*\/FlateDecode)/.test(header);

    const slice = bytes.subarray(start, end);
    let decoded: string | null = null;
    if (isFlate) {
      try {
        decoded = bytesToLatin1(pako.inflate(slice));
      } catch {
        decoded = null; // not actually deflate / corrupt — skip
      }
    } else if (!/\/Filter/.test(header)) {
      decoded = bytesToLatin1(slice); // uncompressed content stream
    }

    if (decoded && /(Tj|TJ)\b/.test(decoded)) {
      const txt = textFromContentStream(decoded).trim();
      if (txt) {
        collected += (collected ? '\n' : '') + txt;
        pagesProcessed += 1;
      }
    }
    streamRe.lastIndex = end + 'endstream'.length;
    if (collected.length > MAX_CHARS) break;
  }

  let text = collected.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + TRUNCATION_NOTE;

  return { text, pageCount };
}

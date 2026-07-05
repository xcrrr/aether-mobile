const toBase64 = (raw: string): string => Buffer.from(raw, 'binary').toString('base64');

/** Minimal hand-built PDF with one uncompressed content stream and one page. */
function pdfBytes(content: string): string {
  const raw =
    `%PDF-1.4\n` +
    `1 0 obj\n<< /Type /Page /Contents 2 0 R >>\nendobj\n` +
    `2 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n` +
    `%%EOF`;
  return toBase64(raw);
}

const encryptedPdfBytes = toBase64('%PDF-1.4\ntrailer\n<< /Encrypt 9 0 R /Root 1 0 R >>\n%%EOF');

let mockFileContents: Record<string, string> = {};
let mockFileSizes: Record<string, number> = {};

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///aether-docs/',
  cacheDirectory: 'file:///aether-cache/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  getInfoAsync: jest.fn(async (uri: string) => ({
    exists: true,
    size: mockFileSizes[uri] ?? 100,
  })),
  readAsStringAsync: jest.fn(async (uri: string) => mockFileContents[uri] ?? ''),
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
}));

jest.mock('mammoth', () => ({
  __esModule: true,
  default: { extractRawText: jest.fn(async () => ({ value: 'Word doc text' })) },
}));

import mammoth from 'mammoth';
import { fileProcessor, FileProcessorError } from './FileProcessor';

beforeEach(() => {
  mockFileContents = {};
  mockFileSizes = {};
  jest.mocked(mammoth.extractRawText).mockClear();
  jest.mocked(mammoth.extractRawText).mockResolvedValue({ value: 'Word doc text', messages: [] });
});

describe('FileProcessor', () => {
  it('extracts text from a readable PDF', async () => {
    mockFileContents['file://a.pdf'] = pdfBytes('BT (Q3 revenue up 12%.) Tj ET');
    const a = await fileProcessor.processFile('file://a.pdf', 'application/pdf', 'a.pdf');
    expect(a.extractedText).toContain('Q3 revenue up 12%.');
    expect(a.processingError).toBeUndefined();
    expect(a.pageCount).toBe(1);
  });

  it('surfaces a clear password-protected message for encrypted PDFs', async () => {
    mockFileContents['file://enc.pdf'] = encryptedPdfBytes;
    const a = await fileProcessor.processFile('file://enc.pdf', 'application/pdf', 'enc.pdf');
    expect(a.processingError).toBe('This PDF is password-protected. Remove the password and try again.');
    expect(a.extractedText).toBeUndefined();
  });

  it('surfaces a scanned-PDF message when no text can be extracted', async () => {
    mockFileContents['file://scan.pdf'] = toBase64('%PDF-1.4\n%%EOF'); // no content streams at all
    const a = await fileProcessor.processFile('file://scan.pdf', 'application/pdf', 'scan.pdf');
    expect(a.processingError).toMatch(/scanned or image-only/);
  });

  it('rejects an oversized PDF before reading it', async () => {
    mockFileSizes['file://huge.pdf'] = 25 * 1024 * 1024;
    await expect(
      fileProcessor.processFile('file://huge.pdf', 'application/pdf', 'huge.pdf'),
    ).rejects.toThrow(FileProcessorError);
  });

  it('rejects an oversized DOCX before reading it', async () => {
    mockFileSizes['file://huge.docx'] = 25 * 1024 * 1024;
    await expect(
      fileProcessor.processFile(
        'file://huge.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'huge.docx',
      ),
    ).rejects.toThrow(FileProcessorError);
  });

  it('extracts text from a DOCX via mammoth', async () => {
    mockFileContents['file://doc.docx'] = toBase64('irrelevant zip bytes');
    const a = await fileProcessor.processFile(
      'file://doc.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc.docx',
    );
    expect(a.extractedText).toBe('Word doc text');
  });

  it('reads a plain text attachment', async () => {
    mockFileContents['file://n.txt'] = 'hello notes';
    const a = await fileProcessor.processFile('file://n.txt', 'text/plain', 'n.txt');
    expect(a.extractedText).toBe('hello notes');
  });

  it('rejects unsupported types before any processing', async () => {
    await expect(
      fileProcessor.processFile('file://x.xlsx', 'application/vnd.ms-excel', 'x.xlsx'),
    ).rejects.toThrow(FileProcessorError);
  });

  it('processes repeated attachments independently with distinct ids', async () => {
    mockFileContents['file://a.pdf'] = pdfBytes('BT (one) Tj ET');
    mockFileContents['file://b.pdf'] = pdfBytes('BT (two) Tj ET');
    const a = await fileProcessor.processFile('file://a.pdf', 'application/pdf', 'a.pdf');
    const b = await fileProcessor.processFile('file://b.pdf', 'application/pdf', 'b.pdf');
    expect(a.id).not.toBe(b.id);
    expect(a.extractedText).toContain('one');
    expect(b.extractedText).toContain('two');
  });
});

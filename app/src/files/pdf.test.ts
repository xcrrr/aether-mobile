import { extractPdfText } from './pdf';

const toBase64 = (raw: string): string => Buffer.from(raw, 'binary').toString('base64');

/** A minimal, hand-built PDF with N page objects and one uncompressed content stream. */
function pdfWithContentStream(content: string, pages = 1): string {
  const pageObjects = Array.from({ length: pages })
    .map((_, i) => `${i + 1} 0 obj\n<< /Type /Page /Contents ${pages + 1} 0 R >>\nendobj\n`)
    .join('');
  const raw =
    `%PDF-1.4\n${pageObjects}` +
    `${pages + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n` +
    `%%EOF`;
  return toBase64(raw);
}

describe('extractPdfText', () => {
  it('extracts literal-string text from an uncompressed content stream', () => {
    const { text, pageCount, encrypted } = extractPdfText(pdfWithContentStream('BT (Hello world) Tj ET'));
    expect(text).toContain('Hello world');
    expect(pageCount).toBe(1);
    expect(encrypted).toBe(false);
  });

  it('counts every /Type /Page object without counting /Type /Pages', () => {
    const raw =
      `%PDF-1.4\n` +
      `1 0 obj\n<< /Type /Pages /Kids [2 0 R 3 0 R] >>\nendobj\n` +
      `2 0 obj\n<< /Type /Page /Contents 4 0 R >>\nendobj\n` +
      `3 0 obj\n<< /Type /Page /Contents 4 0 R >>\nendobj\n` +
      `4 0 obj\n<< /Length 10 >>\nstream\nBT (x) Tj ET\nendstream\nendobj\n%%EOF`;
    const { pageCount } = extractPdfText(toBase64(raw));
    expect(pageCount).toBe(2);
  });

  it('detects an encrypted PDF and returns no text instead of garbage', () => {
    const raw = `%PDF-1.4\ntrailer\n<< /Encrypt 9 0 R /Root 1 0 R >>\n%%EOF`;
    const { text, encrypted } = extractPdfText(toBase64(raw));
    expect(encrypted).toBe(true);
    expect(text).toBe('');
  });

  it('does not throw on malformed bytes with no valid content streams', () => {
    const { text, pageCount, encrypted } = extractPdfText(toBase64('this is not a pdf at all'));
    expect(text).toBe('');
    expect(pageCount).toBe(0);
    expect(encrypted).toBe(false);
  });

  it('truncates very long extracted text and appends a note', () => {
    const longText = 'word '.repeat(2000); // ~10,000 chars, over MAX_CHARS (8000)
    const { text } = extractPdfText(pdfWithContentStream(`BT (${longText}) Tj ET`));
    expect(text.length).toBeLessThan(longText.length);
    expect(text).toContain('(document truncated for context)');
  });
});

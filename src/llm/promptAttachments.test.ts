import { buildUserContent, buildGemmaPrompt } from './prompt';
import { Message, FileAttachment } from '@/types';

const msg = (content: string, attachments?: FileAttachment[]): Message => ({
  id: '1', role: 'user', content, createdAt: 0, ...(attachments ? { attachments } : {}),
});

const img: FileAttachment = {
  id: 'a', uri: 'file://x.jpg', name: 'x.jpg', type: 'image',
  mimeType: 'image/jpeg', sizeBytes: 10, imageBase64: 'AAAA',
};

describe('buildGemmaPrompt media marker placement', () => {
  it('emits the media marker only on the LAST user turn (matches the single forwarded image)', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'first pic', createdAt: 0, attachments: [img] },
      { id: '2', role: 'assistant', content: 'a cat', createdAt: 1 },
      { id: '3', role: 'user', content: 'second pic', createdAt: 2, attachments: [{ ...img, id: 'b' }] },
    ];
    const prompt = buildGemmaPrompt('', messages, true);
    expect(prompt.split('<__media__>').length - 1).toBe(1); // exactly one marker
  });
});

describe('buildUserContent', () => {
  it('returns plain content when there are no attachments', () => {
    expect(buildUserContent(msg('hello'))).toBe('hello');
  });

  it('emits the media marker and an analysis instruction when vision is active', () => {
    const a: FileAttachment = {
      id: 'a', uri: 'file://x.jpg', name: 'x.jpg', type: 'image',
      mimeType: 'image/jpeg', sizeBytes: 10, imageBase64: 'AAAA',
    };
    const out = buildUserContent(msg('what is this?', [a]), true);
    expect(out).toContain('<__media__>');
    expect(out).toContain('actually visible');
    expect(out).toContain("User's message: what is this?");
  });

  it('tells the model it cannot see the image (no marker) when vision is off', () => {
    const a: FileAttachment = {
      id: 'a', uri: 'file://x.jpg', name: 'x.jpg', type: 'image',
      mimeType: 'image/jpeg', sizeBytes: 10, imageBase64: 'AAAA',
    };
    const out = buildUserContent(msg('what is this?', [a]));
    expect(out).not.toContain('<__media__>');
    expect(out).toContain('cannot see it');
    expect(out).toContain("User's message: what is this?");
  });

  it('injects extracted document text as a quoted block', () => {
    const a: FileAttachment = {
      id: 'b', uri: 'file://r.pdf', name: 'report.pdf', type: 'pdf',
      mimeType: 'application/pdf', sizeBytes: 100, extractedText: 'Q3 revenue up 12%.', pageCount: 3,
    };
    const out = buildUserContent(msg('summarize', [a]));
    expect(out).toContain('report.pdf');
    expect(out).toContain('3 pages');
    expect(out).toContain('Q3 revenue up 12%.');
    expect(out).toContain("User's message: summarize");
  });

  it('falls back to a paste request when a document could not be read', () => {
    const a: FileAttachment = {
      id: 'c', uri: 'file://s.pdf', name: 'scan.pdf', type: 'pdf',
      mimeType: 'application/pdf', sizeBytes: 100, processingError: 'unreadable',
    };
    const out = buildUserContent(msg('', [a]));
    expect(out).toContain('scan.pdf');
    expect(out).toContain('copy-paste the relevant text');
  });
});

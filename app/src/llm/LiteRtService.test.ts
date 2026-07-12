jest.mock('@/utils/ramCheck', () => ({ assertRAMSufficient: jest.fn() }));

import { splitConversation } from './LiteRtService';
import { Message, FileAttachment } from '@/types';

const msg = (role: 'user' | 'assistant', content: string): Message =>
  ({ id: content, role, content, createdAt: 0 });

const pdfAttachment = (extractedText: string): FileAttachment => ({
  id: 'doc', uri: 'file://r.pdf', name: 'report.pdf', type: 'pdf',
  mimeType: 'application/pdf', sizeBytes: 100, extractedText, pageCount: 2,
});

describe('LiteRtService.splitConversation', () => {
  it('separates system, prior turns, and the new user turn', () => {
    const { system, historyJson, lastText } = splitConversation('You are Aether.', [
      msg('user', 'hi'),
      msg('assistant', 'Hello!'),
      msg('user', 'how are you'),
    ]);
    expect(system).toBe('You are Aether.');
    expect(lastText).toBe('how are you');
    expect(JSON.parse(historyJson)).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'model', text: 'Hello!' },
    ]);
  });

  it('maps assistant role to litertlm "model" and drops empty turns', () => {
    const { historyJson } = splitConversation('', [
      msg('user', 'a'),
      msg('assistant', ''),
      msg('assistant', 'b'),
      msg('user', 'q'),
    ]);
    expect(JSON.parse(historyJson)).toEqual([
      { role: 'user', text: 'a' },
      { role: 'model', text: 'b' },
    ]);
  });

  it('does NOT flatten into a "User:/Assistant:" blob (no fake-turn tokens)', () => {
    const { lastText, historyJson, system } = splitConversation('sys', [msg('user', 'hi')]);
    expect(lastText).toBe('hi');
    expect(historyJson).toBe('[]');
    expect(system + lastText).not.toContain('Assistant:');
  });

  // Regression: a document's extracted text was computed by FileProcessor and
  // formatted by buildUserContent, but this function threw it away before it
  // ever reached the native generate() call — the model answered with zero
  // knowledge of the attached document. See prompt.ts:buildDocumentContext.
  it('includes a PDF attachment\'s extracted text in the last user turn', () => {
    const withDoc: Message = { ...msg('user', 'summarize this'), attachments: [pdfAttachment('Q3 revenue up 12%.')] };
    const { lastText } = splitConversation('sys', [withDoc]);
    expect(lastText).toContain('report.pdf');
    expect(lastText).toContain('Q3 revenue up 12%.');
    expect(lastText).toContain("User's message: summarize this");
  });

  it('includes an earlier turn\'s document text in history, not just the live turn', () => {
    const withDoc: Message = { ...msg('user', 'what does it say'), attachments: [pdfAttachment('Confidential figures.')] };
    const { historyJson } = splitConversation('sys', [
      withDoc,
      msg('assistant', 'It mentions confidential figures.'),
      msg('user', 'thanks'),
    ]);
    const history = JSON.parse(historyJson);
    expect(history[0].text).toContain('Confidential figures.');
  });

  it('does not add a document block for a message with no attachments', () => {
    const { lastText } = splitConversation('sys', [msg('user', 'hello')]);
    expect(lastText).toBe('hello');
  });
});

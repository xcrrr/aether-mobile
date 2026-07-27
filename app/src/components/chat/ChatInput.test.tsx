import { fireEvent, render } from '@testing-library/react-native';
import { ChatInput } from './ChatInput';
import { AttachmentState } from '@/hooks/useAttachment';
import { FileAttachment } from '@/types';
import { useChatStore } from '@/state/useChatStore';
import { useAgentStore } from '@/state/useAgentStore';

jest.mock('@/theme/useColors', () => {
  const { darkColors } = require('@/theme');
  return { useColors: () => darkColors };
});
jest.mock('@/hooks/useVoice', () => ({
  useVoice: () => ({
    listening: false,
    partial: '',
    error: null,
    toggle: jest.fn(),
    cancel: jest.fn(),
    clearError: jest.fn(),
  }),
}));
jest.mock('./AttachmentSheet', () => ({ AttachmentSheet: () => null }));
jest.mock('./ModeMenu', () => ({ ModeMenu: () => null }));
jest.mock('./ListeningWave', () => ({ ListeningWave: () => null }));

const documentAttachment: FileAttachment = {
  id: 'attachment-1',
  uri: 'file:///project-debrief.txt',
  name: 'project-debrief.txt',
  type: 'text',
  mimeType: 'text/plain',
  sizeBytes: 2400,
  extractedText: 'Decision: keep the review weekly. Owner: prepare the checklist.',
};

const imageAttachment: FileAttachment = {
  id: 'image-1',
  uri: 'file:///reference.jpg',
  name: 'reference.jpg',
  type: 'image',
  mimeType: 'image/jpeg',
  sizeBytes: 1200,
  imageBase64: 'AAAA',
};

function attachmentState(overrides: Partial<AttachmentState> = {}): AttachmentState {
  return {
    attachment: documentAttachment,
    processing: false,
    error: null,
    pickCamera: jest.fn(),
    pickLibrary: jest.fn(),
    pickFiles: jest.fn(),
    paste: jest.fn(),
    remove: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  };
}

describe('ChatInput Task attachments', () => {
  beforeEach(() => {
    useChatStore.setState({ isGenerating: false });
    useAgentStore.setState({ mode: 'balanced' });
  });

  it('submits the selected document with the Task goal and clears the composer copy', () => {
    const onAct = jest.fn();
    const att = attachmentState();
    const screen = render(
      <ChatInput
        onSend={jest.fn()}
        onAct={onAct}
        actMode
        att={att}
      />,
    );

    const goal = 'Turn the attached debrief into concise meeting notes.';
    fireEvent.changeText(screen.getByPlaceholderText('Give Aether a task...'), goal);
    fireEvent.press(screen.getByLabelText('Run task'));

    expect(onAct).toHaveBeenCalledWith(goal, documentAttachment);
    expect(att.remove).toHaveBeenCalledTimes(1);
  });

  it('does not submit an image Task when the active model cannot see images', () => {
    const onAct = jest.fn();
    const att = attachmentState({ attachment: imageAttachment });
    const screen = render(
      <ChatInput
        onSend={jest.fn()}
        onAct={onAct}
        actMode
        supportsVision={false}
        att={att}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('Give Aether a task...'),
      'Analyze this image and explain the main visual risk.',
    );
    fireEvent.press(screen.getByLabelText('Run task'));

    expect(onAct).not.toHaveBeenCalled();
    expect(att.remove).not.toHaveBeenCalled();
  });
});

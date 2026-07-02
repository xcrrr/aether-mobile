import { render, fireEvent } from '@testing-library/react-native';
import { MessageBubble } from './MessageBubble';
import { QuestionCard } from './QuestionCard';
import { CopyBlock } from './CopyBlock';
import { useChatStore } from '@/state/useChatStore';
import { Message } from '@/types';

jest.mock('@/theme/useColors', () => {
  const { darkColors } = require('@/theme');
  return { useColors: () => darkColors };
});
jest.mock('@/components/common/Markdown', () => {
  const { Text } = require('react-native');
  return { MarkdownView: ({ content }: { content: string }) => <Text>{content}</Text> };
});
jest.mock('@/llm/engine', () => ({ stop: jest.fn() }));

const msg = (over: Partial<Message>): Message =>
  ({ id: 'm1', role: 'assistant', content: '', createdAt: 0, ...over });

const QUESTION_JSON = '{"__aether_question": true, "question": "What tone?", "options": ["Formal", "Casual"]}';

describe('MessageBubble', () => {
  beforeEach(() => {
    useChatStore.setState({ isGenerating: false });
  });

  it('REGRESSION: a finished message with broken question JSON never shows the typing indicator', () => {
    // Old failure mode: stream died mid-JSON -> indicator forever (persisted).
    const broken = msg({ content: '{"__aether_question": true, "question": "What tone?", "opti' });
    const s = render(<MessageBubble message={broken} isLast />);
    expect(s.queryByTestId('typing-indicator')).toBeNull();
    expect(s.getByText('What tone?')).toBeTruthy();
  });

  it('REGRESSION: a finished empty reply never shows the typing indicator', () => {
    const s = render(<MessageBubble message={msg({ content: '' })} isLast />);
    expect(s.getByText('(no reply — try again)')).toBeTruthy();
  });

  it('holds the indicator while question JSON is still streaming', () => {
    useChatStore.setState({ isGenerating: true });
    const partial = msg({ content: '{"__aether_question": true, "question": "What t' });
    const s = render(<MessageBubble message={partial} isLast />);
    expect(s.queryByText(/aether_question/)).toBeNull();
  });

  it('keeps already-streamed prose visible when question JSON starts mid-stream', () => {
    useChatStore.setState({ isGenerating: true });
    const partial = msg({ content: 'Let me check one thing.\n{"__aether_question": true, "question": "Wh' });
    const s = render(<MessageBubble message={partial} isLast />);
    expect(s.getByText('Let me check one thing.')).toBeTruthy();
    expect(s.queryByText(/aether_question/)).toBeNull();
  });

  it('REGRESSION: pending normal JSON is visible instead of blanked until finish', () => {
    useChatStore.setState({ isGenerating: true });
    const partial = msg({ content: '{"answer": true}' });
    const s = render(<MessageBubble message={partial} isLast />);
    expect(s.getByText('{"answer": true}')).toBeTruthy();
  });

  it('renders prose AND the question card when both are present (nothing lost)', () => {
    const m = msg({ content: 'One detail first.', question: { question: 'What tone?', options: ['Formal', 'Casual'] } });
    const s = render(<MessageBubble message={m} isLast />);
    expect(s.getByText('One detail first.')).toBeTruthy();
    expect(s.getByText('What tone?')).toBeTruthy();
    expect(s.getByText('Formal')).toBeTruthy();
  });

  it('heals a legacy persisted raw-JSON message into a question card at render', () => {
    const s = render(<MessageBubble message={msg({ content: QUESTION_JSON })} isLast />);
    expect(s.getByText('What tone?')).toBeTruthy();
    expect(s.queryByText(/aether_question/)).toBeNull();
  });

  it('passes the tapped option and message id up', () => {
    const onSelect = jest.fn();
    const m = msg({ question: { question: 'Q?', options: ['A', 'B'] } });
    const s = render(<MessageBubble message={m} isLast onOptionSelect={onSelect} />);
    fireEvent.press(s.getByText('B'));
    expect(onSelect).toHaveBeenCalledWith('B', 'm1');
  });
});

describe('QuestionCard', () => {
  const question = { question: 'What tone?', options: ['Formal', 'Casual'] };

  it('locks after a tap and ignores further taps (double-tap guard)', () => {
    const onSelect = jest.fn();
    const s = render(<QuestionCard question={question} answered={false} onSelect={onSelect} />);
    fireEvent.press(s.getByText('Formal'));
    fireEvent.press(s.getByText('Formal'));
    fireEvent.press(s.getByText('Casual'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('Formal');
  });

  it('shows the persisted pick highlighted after restart/navigation', () => {
    const onSelect = jest.fn();
    const s = render(<QuestionCard question={question} answered picked="Casual" onSelect={onSelect} />);
    fireEvent.press(s.getByText('Formal'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(s.getByText('Casual')).toBeTruthy();
  });

  it('locks when answered by a later message even without a recorded pick', () => {
    const onSelect = jest.fn();
    const s = render(<QuestionCard question={question} answered onSelect={onSelect} />);
    fireEvent.press(s.getByText('Formal'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('CopyBlock', () => {
  it('hides the copy button while the block is still streaming', () => {
    const s = render(<CopyBlock content="partial art" pending />);
    expect(s.queryByLabelText('Copy')).toBeNull();
  });

  it('shows the copy button once complete', () => {
    const s = render(<CopyBlock content="done" />);
    expect(s.getByLabelText('Copy')).toBeTruthy();
  });
});

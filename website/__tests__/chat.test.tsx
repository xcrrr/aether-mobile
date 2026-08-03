import { render, screen } from '@testing-library/react';
import { UserTurn, AssistantTurn, TypingDots, Composer } from '@/components/demos/kit/chat';

test('user bubble matches the app: quiet dark surface, not violet', () => {
  render(<UserTurn text="Hi Aether" />);
  const bubble = screen.getByText('Hi Aether');
  expect(bubble.style.background).toBe('rgb(37, 37, 37)');
});

test('assistant turn shows Aether label and serif content', () => {
  render(<AssistantTurn blocks={[{ kind: 'p', text: 'Hello there' }]} revealed={11} />);
  expect(screen.getByText('Aether')).toBeInTheDocument();
  const body = screen.getByText('Hello there').parentElement as HTMLElement;
  expect(body.style.fontFamily).toContain('--font-serif-stack');
});

test('typing dots renders three dots', () => {
  const { container } = render(<TypingDots />);
  expect(container.querySelectorAll('[data-dot]')).toHaveLength(3);
});

test('composer shows placeholder, the Chat mode trigger, and the on-device disclaimer', () => {
  render(<Composer />);
  expect(screen.getByText('Message Aether')).toBeInTheDocument();
  expect(screen.getByText('Chat')).toBeInTheDocument();
  expect(screen.getByText(/can make mistakes\. Replies run on-device\./)).toBeInTheDocument();
});

test('research mode swaps in the web bar and drops the on-device claim', () => {
  render(<Composer mode="research" placeholder="Research the web..." />);
  expect(screen.getByText('Research')).toBeInTheDocument();
  expect(screen.getByText('· Uses the web')).toBeInTheDocument();
  expect(screen.queryByText(/Replies run on-device/)).not.toBeInTheDocument();
});

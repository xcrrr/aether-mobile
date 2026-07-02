import { render, screen } from '@testing-library/react';
import { UserBubble } from '@/components/phone/chat/UserBubble';
import { AssistantTurn } from '@/components/phone/chat/AssistantTurn';
import { TypingDots } from '@/components/phone/chat/TypingDots';
import { InputBar } from '@/components/phone/chat/InputBar';

test('user bubble matches the app: quiet dark surface, not violet', () => {
  const { container } = render(<UserBubble text="Hi Aether" />);
  expect(screen.getByText('Hi Aether')).toBeInTheDocument();
  const bubble = container.querySelector('[data-user-bubble]') as HTMLElement;
  expect(bubble.style.backgroundColor).toBe('rgb(37, 37, 37)');
});

test('assistant turn shows Aether label and serif content', () => {
  render(<AssistantTurn text="Hello there" />);
  expect(screen.getByText('Aether')).toBeInTheDocument();
  const body = screen.getByText('Hello there');
  expect(body).toBeInTheDocument();
  expect(body.style.fontFamily).toContain('--font-serif-stack');
});

test('typing dots renders three dots', () => {
  const { container } = render(<TypingDots />);
  expect(container.querySelectorAll('[data-dot]')).toHaveLength(3);
});

test('input bar shows placeholder, mode chip, and disclaimer', () => {
  render(<InputBar />);
  expect(screen.getByText('Message Aether')).toBeInTheDocument();
  expect(screen.getByText('Fast')).toBeInTheDocument();
  expect(screen.getByText(/can make mistakes/)).toBeInTheDocument();
});

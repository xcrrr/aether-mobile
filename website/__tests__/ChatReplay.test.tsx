import { render, screen } from '@testing-library/react';
import { ChatReplayView } from '@/components/phone/ChatReplay';
import { conversation } from '@/content/script';

test('progress=1 renders all beats fully', () => {
  render(<ChatReplayView beats={conversation} progress={1} />);
  expect(screen.getByText(conversation[0].text)).toBeInTheDocument();
  expect(screen.getByText(conversation[3].text)).toBeInTheDocument();
});

test('progress=0 renders no conversation text', () => {
  render(<ChatReplayView beats={conversation} progress={0} />);
  expect(screen.queryByText(conversation[1].text)).not.toBeInTheDocument();
});

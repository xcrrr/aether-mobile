import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

test('page composes the full narrative', () => {
  render(<Home />);
  expect(screen.getByText(/The assistant that stays on your phone/i)).toBeInTheDocument();
  expect(screen.getByText(/Why local-first/i)).toBeInTheDocument();
  expect(screen.getByText(/It remembers what matters/i)).toBeInTheDocument();
  expect(screen.getByText(/Where things actually run/i)).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /Join the beta/i }).length).toBeGreaterThan(0);
});

test('page keeps honest scoping: no absolute privacy claims', () => {
  const { container } = render(<Home />);
  container.querySelectorAll('style').forEach((el) => el.remove());
  const text = container.textContent ?? '';
  expect(text).not.toMatch(/100%/);
  expect(text).not.toMatch(/nothing ever leaves/i);
  expect(text).not.toMatch(/fully (offline|private|secure)/i);
});

test('demo and privacy anchors exist for nav links', () => {
  const { container } = render(<Home />);
  expect(container.querySelector('#demo')).toBeTruthy();
  expect(container.querySelector('#privacy')).toBeTruthy();
  expect(container.querySelector('#memory')).toBeTruthy();
});

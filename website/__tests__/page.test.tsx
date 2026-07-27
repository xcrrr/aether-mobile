import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

test('page composes the full narrative', () => {
  render(<Home />);
  expect(screen.getByRole('heading', { name: /Think without starting over/i })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: /Aether's mission: your phone is enough/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /It remembers what matters/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /What Aether can do/i })).toBeInTheDocument();
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

test('main navigation anchors resolve to homepage sections', () => {
  const { container } = render(<Home />);
  expect(container.querySelector('#mission')).toBeTruthy();
  expect(container.querySelector('#memory')).toBeTruthy();
  expect(container.querySelector('#features')).toBeTruthy();
});

import { render, screen } from '@testing-library/react';
import { PhoneStory } from '@/components/sections/PhoneStory';

function mockMatchMedia(reducedMatches: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('prefers-reduced-motion') ? reducedMatches : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

test('renders the sticky scroll story by default', () => {
  mockMatchMedia(false);
  const { container } = render(<PhoneStory />);
  expect(container.querySelector('#mission')).toBeTruthy();
  expect(screen.getByText(/Keep scrolling/i)).toBeInTheDocument();
});

test('reduced motion gets the static conversation instead of a scroll scene', () => {
  mockMatchMedia(true);
  render(<PhoneStory />);
  expect(screen.getByText(/Your phone is enough/i)).toBeInTheDocument();
  expect(screen.queryByText(/Keep scrolling/i)).not.toBeInTheDocument();
});

import { AccessibilityInfo, Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import { ModelLoadingOverlay } from './ModelLoadingOverlay';

jest.mock('@/theme/useColors', () => {
  const { darkColors } = require('@/theme');
  return { useColors: () => darkColors };
});

const props = {
  modelName: 'Gemma',
  sizeLabel: '2 GB',
  sizeGb: 2,
};

describe('ModelLoadingOverlay', () => {
  beforeEach(() => {
    jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as any);
    jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as any);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>(() => undefined));
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the quiet local preparation copy without numeric progress', () => {
    const screen = render(<ModelLoadingOverlay {...props} />);

    expect(screen.getByText('Preparing locally')).toBeTruthy();
    expect(screen.getByText('Your model stays on this device')).toBeTruthy();
    expect(screen.queryByText(/\d+%/)).toBeNull();
    expect(screen.getByLabelText('Preparing locally. Your model stays on this device.')).toBeTruthy();
  });

  it('allows the preparation copy to be replaced', () => {
    const screen = render(
      <ModelLoadingOverlay
        {...props}
        primaryText="Starting privately"
        secondaryText="Offline session only"
      />,
    );

    expect(screen.getByText('Starting privately')).toBeTruthy();
    expect(screen.getByText('Offline session only')).toBeTruthy();
    expect(screen.queryByText('Preparing locally')).toBeNull();
  });
});

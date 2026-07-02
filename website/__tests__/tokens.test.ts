import { colors, radius } from '@/lib/tokens';

test('phone mock ports the exact app dark palette', () => {
  expect(colors.bg).toBe('#1C1C1C');
  expect(colors.bgInput).toBe('#252525');
  expect(colors.border).toBe('#2E2E2E');
  expect(colors.violet).toBe('#7C3AED');
  expect(colors.textMuted).toBe('#8E8E8E');
});

test('ports the app radius scale', () => {
  expect(radius.sm).toBe(8);
  expect(radius.md).toBe(12);
  expect(radius.full).toBe(999);
});

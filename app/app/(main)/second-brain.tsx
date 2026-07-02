import { lazy, Suspense } from 'react';
import { View } from 'react-native';
import { colors } from '@/theme';

const SecondBrainScreen = lazy(() =>
  Promise.resolve({ default: require('@/components/settings/SecondBrainScreen').default }),
);

export default function SecondBrainRoute() {
  return (
    <Suspense fallback={<View style={{ flex: 1, backgroundColor: colors.bg }} />}>
      <SecondBrainScreen />
    </Suspense>
  );
}

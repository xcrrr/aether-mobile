import { Stack } from 'expo-router';
import { useColors } from '@/theme/useColors';

export default function OnboardingLayout() {
  const c = useColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}

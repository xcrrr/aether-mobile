import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { getReleaseGateStatus } from '@/legal/gate';
import { useProfileStore } from '@/state/useProfileStore';

export default function Index() {
  const hydrated = useProfileStore((s) => s.hydrated);
  const onboarded = useProfileStore((s) => s.onboarded);
  const legalAcceptance = useProfileStore((s) => s.legalAcceptance);
  if (!hydrated) return <View style={{ flex: 1 }} />;
  const status = getReleaseGateStatus({ onboarded, acceptance: legalAcceptance });
  return <Redirect href={status === 'unlocked' ? '/(main)' : '/onboarding'} />;
}

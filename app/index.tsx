import { Redirect } from 'expo-router';
import { useProfileStore } from '@/state/useProfileStore';

export default function Index() {
  const onboarded = useProfileStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/(main)' : '/onboarding'} />;
}

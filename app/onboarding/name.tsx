import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';

export default function Name() {
  const set = useOnboardingDraft((s) => s.set);
  return (
    <OnboardingStep
      title="Welcome to Aether"
      subtitle="What should I call you?"
      placeholder="Your name"
      onNext={(v) => { set({ name: v }); router.push('/onboarding/occupation'); }}
    />
  );
}

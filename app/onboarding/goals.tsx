import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';

export default function Goals() {
  const set = useOnboardingDraft((s) => s.set);
  return (
    <OnboardingStep
      title="How can I help?"
      subtitle="What do you want help with?"
      placeholder="e.g. Writing code"
      onNext={(v) => { set({ goals: v }); router.push('/onboarding/language'); }}
    />
  );
}

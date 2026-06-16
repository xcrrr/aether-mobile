import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';

export default function Occupation() {
  const set = useOnboardingDraft((s) => s.set);
  return (
    <OnboardingStep
      title="What do you do?"
      subtitle="Your role or occupation."
      placeholder="e.g. Software engineer"
      onNext={(v) => { set({ occupation: v }); router.push('/onboarding/project'); }}
    />
  );
}

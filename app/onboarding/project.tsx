import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';

export default function Project() {
  const set = useOnboardingDraft((s) => s.set);
  return (
    <OnboardingStep
      title="What are you working on?"
      subtitle="Your current project."
      placeholder="e.g. A mobile app"
      onNext={(v) => { set({ project: v }); router.push('/onboarding/goals'); }}
    />
  );
}

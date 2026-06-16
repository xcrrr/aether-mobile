import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';
import { useProfileStore } from '@/state/useProfileStore';

export default function Goals() {
  const draft = useOnboardingDraft((s) => s.draft);
  const complete = useProfileStore((s) => s.completeOnboarding);
  return (
    <OnboardingStep
      title="How can I help?"
      subtitle="What do you want help with?"
      placeholder="e.g. Writing code"
      cta="Finish"
      onNext={async (v) => {
        await complete({
          name: draft.name ?? '',
          occupation: '',
          project: '',
          goals: v,
          language: 'English',
        });
        router.replace('/(main)');
      }}
    />
  );
}

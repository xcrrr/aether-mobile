import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';
import { useProfileStore } from '@/state/useProfileStore';

export default function Language() {
  const draft = useOnboardingDraft((s) => s.draft);
  const complete = useProfileStore((s) => s.completeOnboarding);
  return (
    <OnboardingStep
      title="Preferred language"
      subtitle="I'll always reply in this language."
      placeholder="e.g. English"
      cta="Finish"
      initial="English"
      onNext={async (v) => {
        await complete({
          name: draft.name ?? '', occupation: draft.occupation ?? '',
          project: draft.project ?? '', goals: draft.goals ?? '', language: v,
        });
        router.replace('/(main)');
      }}
    />
  );
}

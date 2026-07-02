import {
  hasAcceptedCurrentDocument,
  hasAcceptedRequiredLegal,
  type LegalAcceptanceMap,
} from './acceptance';

export interface ReleaseGateInput {
  onboarded: boolean;
  acceptance: LegalAcceptanceMap;
}

export type ReleaseGateStatus =
  | 'needs-beta-terms'
  | 'needs-profile-onboarding'
  | 'unlocked';

export function getReleaseGateStatus(input: ReleaseGateInput): ReleaseGateStatus {
  if (!hasAcceptedRequiredLegal(input.acceptance)) return 'needs-beta-terms';
  if (!input.onboarded) return 'needs-profile-onboarding';
  return 'unlocked';
}

export function canEnterMainApp(input: ReleaseGateInput): boolean {
  return getReleaseGateStatus(input) === 'unlocked';
}

export function needsBetaTermsReacceptance(acceptance: LegalAcceptanceMap): boolean {
  return !hasAcceptedCurrentDocument(acceptance, 'beta-terms');
}


import {
  hasAcceptedCurrentDocument,
  type LegalAcceptanceMap,
} from './acceptance';

export type ResearchDisclosureAction = 'show-disclosure' | 'run-research';

export function getResearchDisclosureAction(acceptance: LegalAcceptanceMap): ResearchDisclosureAction {
  return hasAcceptedCurrentDocument(acceptance, 'research-disclosure')
    ? 'run-research'
    : 'show-disclosure';
}


import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  acceptLegalDocument,
  clearLegalAcceptanceRecords,
  hasAcceptedCurrentDocument,
  hasAcceptedRequiredLegal,
  loadLegalAcceptanceMap,
  type LegalAcceptanceRecord,
} from './acceptance';
import { getReleaseGateStatus } from './gate';
import { getResearchDisclosureAction } from './researchDisclosure';
import { getLegalDocument, LEGAL_DOCUMENTS } from './documents';
import { KEYS } from '@/storage/keys';

beforeEach(() => AsyncStorage.clear());

describe('closed beta legal acceptance', () => {
  it('blocks the main app before current Beta Terms are accepted', async () => {
    const acceptance = await loadLegalAcceptanceMap();
    expect(getReleaseGateStatus({ onboarded: true, acceptance })).toBe('needs-beta-terms');
  });

  it('unlocks the app after accepted terms and completed profile onboarding', async () => {
    await acceptLegalDocument('beta-terms');
    const acceptance = await loadLegalAcceptanceMap();
    expect(hasAcceptedRequiredLegal(acceptance)).toBe(true);
    expect(getReleaseGateStatus({ onboarded: true, acceptance })).toBe('unlocked');
  });

  it('does not unlock when the user declines instead of accepting', async () => {
    const acceptance = await loadLegalAcceptanceMap();
    expect(getReleaseGateStatus({ onboarded: true, acceptance })).toBe('needs-beta-terms');
  });

  it('requires re-acceptance when the Beta Terms version changes', async () => {
    const stale: LegalAcceptanceRecord = {
      documentId: 'beta-terms',
      version: 'previous-version',
      acceptedAt: new Date().toISOString(),
      appVersion: '2.1.0',
      appBuild: '4',
    };
    await AsyncStorage.setItem(KEYS.legalAcceptance, JSON.stringify([stale]));
    const acceptance = await loadLegalAcceptanceMap();
    expect(hasAcceptedCurrentDocument(acceptance, 'beta-terms')).toBe(false);
    expect(getReleaseGateStatus({ onboarded: true, acceptance })).toBe('needs-beta-terms');
  });

  it('returns to onboarding behavior when legal acceptance data is cleared', async () => {
    await acceptLegalDocument('beta-terms');
    expect(hasAcceptedRequiredLegal(await loadLegalAcceptanceMap())).toBe(true);
    await clearLegalAcceptanceRecords();
    expect(getReleaseGateStatus({ onboarded: true, acceptance: await loadLegalAcceptanceMap() })).toBe('needs-beta-terms');
  });

  it('keeps all legal documents addressable after onboarding', () => {
    expect(LEGAL_DOCUMENTS.map((doc) => doc.id)).toEqual([
      'beta-terms',
      'privacy-notice',
      'research-disclosure',
      'ai-safety-notice',
    ]);
    expect(getLegalDocument('privacy-notice').requiredAcceptance).toBe(false);
  });

  it('shows Research disclosure before first Research use', async () => {
    const acceptance = await loadLegalAcceptanceMap();
    expect(getResearchDisclosureAction(acceptance)).toBe('show-disclosure');
  });

  it('runs Research only after the current Research disclosure is accepted', async () => {
    await acceptLegalDocument('research-disclosure');
    const acceptance = await loadLegalAcceptanceMap();
    expect(getResearchDisclosureAction(acceptance)).toBe('run-research');
  });

  it('does not require Research disclosure for normal local chat app entry', async () => {
    await acceptLegalDocument('beta-terms');
    const acceptance = await loadLegalAcceptanceMap();
    expect(getReleaseGateStatus({ onboarded: true, acceptance })).toBe('unlocked');
    expect(getResearchDisclosureAction(acceptance)).toBe('show-disclosure');
  });
});


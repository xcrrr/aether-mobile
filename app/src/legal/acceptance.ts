import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_BUILD_NUMBER, APP_VERSION } from '@/release/appInfo';
import { KEYS } from '@/storage/keys';
import { safeParse } from '@/storage/json';
import {
  LEGAL_DOCUMENTS,
  REQUIRED_LEGAL_DOCUMENT_IDS,
  getLegalDocument,
  type LegalDocumentId,
} from './documents';

export interface LegalAcceptanceRecord {
  documentId: LegalDocumentId;
  version: string;
  acceptedAt: string;
  appVersion: string;
  appBuild?: string;
}

export type LegalAcceptanceMap = Partial<Record<LegalDocumentId, LegalAcceptanceRecord>>;

function normalize(records: LegalAcceptanceRecord[]): LegalAcceptanceMap {
  const known = new Set<LegalDocumentId>(LEGAL_DOCUMENTS.map((doc) => doc.id));
  const map: LegalAcceptanceMap = {};
  for (const record of records) {
    if (!known.has(record.documentId)) continue;
    const current = map[record.documentId];
    if (!current || record.acceptedAt > current.acceptedAt) {
      map[record.documentId] = record;
    }
  }
  return map;
}

export async function loadLegalAcceptanceRecords(): Promise<LegalAcceptanceRecord[]> {
  return safeParse<LegalAcceptanceRecord[]>(
    await AsyncStorage.getItem(KEYS.legalAcceptance),
    [],
  );
}

export async function loadLegalAcceptanceMap(): Promise<LegalAcceptanceMap> {
  return normalize(await loadLegalAcceptanceRecords());
}

export function hasAcceptedCurrentDocument(
  map: LegalAcceptanceMap,
  documentId: LegalDocumentId,
): boolean {
  const doc = getLegalDocument(documentId);
  return map[documentId]?.version === doc.version;
}

export function hasAcceptedRequiredLegal(map: LegalAcceptanceMap): boolean {
  return REQUIRED_LEGAL_DOCUMENT_IDS.every((id) => hasAcceptedCurrentDocument(map, id));
}

export async function acceptLegalDocument(documentId: LegalDocumentId): Promise<LegalAcceptanceRecord> {
  const doc = getLegalDocument(documentId);
  const next: LegalAcceptanceRecord = {
    documentId,
    version: doc.version,
    acceptedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    appBuild: APP_BUILD_NUMBER,
  };
  const existing = await loadLegalAcceptanceRecords();
  const filtered = existing.filter(
    (record) => !(record.documentId === documentId && record.version === doc.version),
  );
  await AsyncStorage.setItem(KEYS.legalAcceptance, JSON.stringify([...filtered, next]));
  return next;
}

export async function clearLegalAcceptanceRecords(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.legalAcceptance);
}


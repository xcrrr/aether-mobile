export type LegalDocumentId =
  | 'beta-terms'
  | 'privacy-notice'
  | 'research-disclosure'
  | 'ai-safety-notice';

export type LegalDocumentStatus = 'draft-review-required' | 'implementation-disclosure';

export interface LegalDocumentSection {
  heading: string;
  body: string[];
}

export interface LegalDocument {
  id: LegalDocumentId;
  version: string;
  title: string;
  effectiveDate: string;
  status: LegalDocumentStatus;
  requiredAcceptance: boolean;
  summary: string;
  reviewNotice: string;
  sections: LegalDocumentSection[];
  publicUrl?: string;
}

export const DRAFT_REVIEW_NOTICE =
  'Draft — requires review by the publisher / legal representative before release.';

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: 'beta-terms',
    version: '2026.07.02-draft.1',
    title: 'Closed Beta Terms',
    effectiveDate: '2026-07-02',
    status: 'draft-review-required',
    requiredAcceptance: true,
    summary: 'Required before using this closed beta build.',
    reviewNotice: DRAFT_REVIEW_NOTICE,
    sections: [
      {
        heading: 'Closed beta status',
        body: [
          'Aether is in closed beta. Features may be incomplete, change, or fail during testing.',
          'This draft is a product-facing container for publisher-approved terms. It is not final legal text.',
        ],
      },
      {
        heading: 'Local-first assistant',
        body: [
          'After a model is installed, regular chat generation is designed to run on this device through the bundled LiteRT engine.',
          'Some features are networked when the user starts them, including model downloads and online Research.',
        ],
      },
      {
        heading: 'User responsibilities',
        body: [
          'Use the beta with care, especially around personal, sensitive, medical, legal, financial, or safety-critical information.',
          'AI responses can be wrong. Review important outputs before relying on them.',
        ],
      },
      {
        heading: 'Publisher details required',
        body: [
          'Final publisher identity, support contact, privacy contact, jurisdiction, age policy, and release conditions must be supplied before public release.',
        ],
      },
    ],
  },
  {
    id: 'privacy-notice',
    version: '2026.07.02-draft.1',
    title: 'Privacy Notice',
    effectiveDate: '2026-07-02',
    status: 'draft-review-required',
    requiredAcceptance: false,
    summary: 'Readable notice for local storage, Research, downloads, voice, images, and files.',
    reviewNotice: DRAFT_REVIEW_NOTICE,
    sections: [
      {
        heading: 'What stays local in this build',
        body: [
          'Conversations, profile details, settings, Core memory, agent task records, and attachment metadata are stored locally by the app.',
          'Image attachments are copied into app document storage for display in old conversations. Inline image base64 is stripped before conversation storage.',
        ],
      },
      {
        heading: 'Networked features',
        body: [
          'Model downloads fetch LiteRT model files from Hugging Face URLs listed in the app model registry.',
          'Research searches DuckDuckGo HTML results and fetches public web pages selected from those results. The research query and fetched page requests leave the device.',
        ],
      },
      {
        heading: 'Voice, files, and images',
        body: [
          'Voice input uses the device speech recognition service after microphone permission is granted.',
          'Files and images are processed locally after the user chooses them. PDFs, text files, and Word documents may have text extracted into the conversation context.',
        ],
      },
      {
        heading: 'Not configured yet',
        body: [
          'No account system, analytics SDK, or crash reporting SDK was identified in the mobile app source during this audit.',
          'Publisher privacy contact, public Privacy Policy URL, retention commitments, and app-store disclosures still require owner and legal review.',
        ],
      },
    ],
  },
  {
    id: 'research-disclosure',
    version: '2026.07.02-draft.1',
    title: 'Online Research Disclosure',
    effectiveDate: '2026-07-02',
    status: 'implementation-disclosure',
    requiredAcceptance: false,
    summary: 'Shown before first use of Research.',
    reviewNotice: DRAFT_REVIEW_NOTICE,
    sections: [
      {
        heading: 'Before you research',
        body: [
          'Research uses online sources. Your research query is sent to DuckDuckGo HTML search, and Aether fetches public pages from selected results.',
          'Fetched web text is cleaned and passed into the local model to draft a cited answer.',
        ],
      },
      {
        heading: 'Separate from local chat',
        body: [
          'Ordinary chat does not run this web-search flow. Use Research only when you want Aether to read online sources.',
          'Aether Actions can use the same online Research tool when a task calls for web sources.',
          'You can decline this disclosure and continue using local chat.',
        ],
      },
    ],
  },
  {
    id: 'ai-safety-notice',
    version: '2026.07.02-draft.1',
    title: 'AI Safety Notice',
    effectiveDate: '2026-07-02',
    status: 'draft-review-required',
    requiredAcceptance: false,
    summary: 'Plain-language limitations for AI responses and beta features.',
    reviewNotice: DRAFT_REVIEW_NOTICE,
    sections: [
      {
        heading: 'AI limits',
        body: [
          'Aether can make mistakes, miss context, or produce incomplete answers. Review important outputs before acting on them.',
          'Do not use beta output as the only source for medical, legal, financial, emergency, or safety-critical decisions.',
        ],
      },
      {
        heading: 'Agent actions',
        body: [
          'Aether Actions records local task steps and receipts. The app should ask before higher-risk write actions according to its policy mode.',
          'Review task outputs and attachments before sharing or relying on them.',
        ],
      },
    ],
  },
];

export const REQUIRED_LEGAL_DOCUMENT_IDS: LegalDocumentId[] = LEGAL_DOCUMENTS
  .filter((doc) => doc.requiredAcceptance)
  .map((doc) => doc.id);

export function getLegalDocument(id: LegalDocumentId): LegalDocument {
  const doc = LEGAL_DOCUMENTS.find((item) => item.id === id);
  if (!doc) throw new Error(`Unknown legal document: ${id}`);
  return doc;
}

export function getLegalDocumentLabel(id: LegalDocumentId): string {
  return getLegalDocument(id).title;
}

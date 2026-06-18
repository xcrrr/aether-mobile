export type MessageRole = 'user' | 'assistant';

/** A file the user attached to a message (image or extracted document). */
export type AttachmentType = 'image' | 'pdf' | 'text' | 'docx';

export interface FileAttachment {
  id: string;
  /** Local file URI. */
  uri: string;
  /** Display name. */
  name: string;
  type: AttachmentType;
  mimeType: string;
  sizeBytes: number;
  /** Populated for non-image types after text extraction. */
  extractedText?: string;
  /** Populated for images (raw base64, no data-URI prefix). */
  imageBase64?: string;
  /** Number of pages, for PDFs. */
  pageCount?: number;
  /** Set when extraction failed or could not run — drives the warning badge. */
  processingError?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  /** Set when generation was aborted by the user — renders a muted "(stopped)" suffix. */
  stopped?: boolean;
  /** Files attached to this (user) message. */
  attachments?: FileAttachment[];
}

export interface Conversation {
  id: string;
  modelId: string;
  messages: Message[];
}

export interface ConversationMeta {
  id: string;
  title: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

export interface UserProfile {
  name: string;
  occupation: string;
  project: string;
  goals: string;
  language: string;
}

export interface AppSettings {
  activeModelId: string | null;
}

export interface ModelDef {
  id: string;
  name: string;
  maker: string;
  description: string;
  sizeBytes: number;
  /** Nominal on-disk size in GB — used for the pre-load RAM headroom check. */
  sizeGb: number;
  sizeLabel: string;
  minRamGb: number;
  contextLength: number;
  downloadUrl: string;
  filename: string;
  color: string;
  badge: string;
  /** Whether the model can analyze image attachments (multimodal). */
  supportsVision: boolean;
  /** Multimodal projector ("vision pack") — downloaded on demand to enable image analysis. */
  mmprojUrl?: string;
  mmprojFilename?: string;
  mmprojSizeBytes?: number;
}

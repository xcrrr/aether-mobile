import type { AgentReceipt } from '@/agent/types';

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
  /** Core notes provided as context for this (assistant) reply, with the reason
   *  each was selected. Only set when topical recall actually fired. */
  coreRecall?: { key: string; why: string }[];
  /** Structured clarifying question, set when an assistant reply finalizes into
   *  a question card. `content` then holds only the surrounding prose. */
  question?: { question: string; options: string[] };
  /** The option the user tapped on this message's question card. Persisted so
   *  the picked highlight survives navigation and restart. */
  questionAnswer?: string;
  /** Set when this reply was produced by an Aether Actions task. */
  agentTaskId?: string;
  /** The task's receipt — what actually ran. Set once the task ends. */
  agentReceipt?: AgentReceipt;
  /** Structured research handoff, set only on a Research-mode reply. Lets a later
   *  Task follow-up in the same conversation ("make a document about why he died")
   *  see what was actually found instead of re-deriving it from rendered markdown. */
  research?: { query: string; answer: string; sources: { title: string; url: string }[] };
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
  /** Set once a real title is locked in (AI-generated). Stops the provisional
   *  first-message title from clobbering it on later saves. */
  titled?: boolean;
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
  /** Whether the model can analyze image attachments. LiteRT `.litertlm` bundles are
   *  multimodal in one file — vision is built in, no separate pack. */
  supportsVision: boolean;
}

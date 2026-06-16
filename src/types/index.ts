export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
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
  sizeLabel: string;
  minRamGb: number;
  contextLength: number;
  downloadUrl: string;
  filename: string;
  color: string;
  badge: string;
}

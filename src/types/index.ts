export type PlatformType =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'gmail'
  | 'manual'
  | 'other';

export interface CapsuleMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp?: string;
}

export interface CapsuleVersion {
  version: number;
  updatedAt: string;
  title: string;
  content: string;
  summary: string;
}

export interface Capsule {
  id: string;
  title: string;
  summary: string;
  content: string;
  messages?: CapsuleMessage[];
  platform: PlatformType;
  sourceUrl?: string;
  folderId?: string;
  tags: string[];
  isPinned: boolean;
  version: number;
  history?: CapsuleVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface CapsuleFilter {
  search: string;
  platform: 'all' | PlatformType;
  folderId: string | 'all';
  pinnedOnly: boolean;
}

export type ExtensionMessage =
  | { type: 'INJECT_CONTEXT'; payload: { text: string } }
  | { type: 'TRIGGER_DOM_CAPTURE'; payload?: { platform?: PlatformType } }
  | { type: 'DOM_CAPTURED_SUCCESS'; payload: Partial<Capsule> }
  | { type: 'PING' };

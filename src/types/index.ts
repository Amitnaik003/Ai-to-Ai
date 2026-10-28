export type PlatformType =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'perplexity'
  | 'deepseek'
  | 'gmail'
  | 'manual'
  | 'other';

export interface CapsuleMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp?: string;
}

export interface Capsule {
  id: string;
  title: string;
  summary: string;
  content: string;
  messages?: CapsuleMessage[];
  platform: PlatformType;
  sourceUrl?: string;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CapsuleFilter {
  search: string;
  platform: 'all' | PlatformType;
  pinnedOnly: boolean;
  securityAlertsOnly?: boolean;
}

export interface SecurityFinding {
  type: 'api_key' | 'private_key' | 'connection_string' | 'credential';
  label: string;
  snippet: string;
  count: number;
}

export interface SecurityAuditResult {
  isSecure: boolean;
  findings: SecurityFinding[];
  totalSecrets: number;
  riskLevel: 'safe' | 'medium' | 'high';
}

export type ExtensionMessage =
  | { type: 'INJECT_CONTEXT'; payload: { text: string } }
  | { type: 'TRIGGER_DOM_CAPTURE'; payload?: { platform?: PlatformType } }
  | { type: 'DOM_CAPTURED_SUCCESS'; payload: Partial<Capsule> }
  | { type: 'PING' };

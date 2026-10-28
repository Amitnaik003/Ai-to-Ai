import type { SecurityFinding, SecurityAuditResult } from "../types";

/**
 * Secret & Sensitive Credential Detection Patterns
 * Identifies API keys, private keys, database URLs, auth tokens, and sensitive credentials
 * to prevent accidental exfiltration across LLM endpoints.
 */
interface PatternRule {
  type: SecurityFinding["type"];
  label: string;
  regex: RegExp;
  maskReplacement: (match: string) => string;
}

const SECURITY_RULES: PatternRule[] = [
  // OpenAI API Keys (legacy and project-scoped)
  {
    type: "api_key",
    label: "OpenAI API Key",
    regex: /\b(sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_-]{20,})\b/g,
    maskReplacement: (m) => `${m.slice(0, 7)}••••••••[REDACTED_OPENAI_KEY]`
  },

  // Anthropic API Keys
  {
    type: "api_key",
    label: "Anthropic API Key",
    regex: /\b(sk-ant-[a-zA-Z0-9_-]{20,})\b/g,
    maskReplacement: (m) => `${m.slice(0, 10)}••••••••[REDACTED_ANTHROPIC_KEY]`
  },

  // Google Gemini / Cloud API Keys
  {
    type: "api_key",
    label: "Google API Key",
    regex: /\b(AIza[0-9A-Za-z-_]{35})\b/g,
    maskReplacement: () => `AIza••••••••[REDACTED_GOOGLE_KEY]`
  },

  // GitHub Personal Access Tokens
  {
    type: "api_key",
    label: "GitHub Token",
    regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})\b/g,
    maskReplacement: (m) => `${m.slice(0, 7)}••••••••[REDACTED_GITHUB_TOKEN]`
  },

  // AWS Access Key ID
  {
    type: "api_key",
    label: "AWS Access Key",
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    maskReplacement: () => `AKIA••••••••[REDACTED_AWS_KEY]`
  },

  // Stripe Secret / Restricted Keys
  {
    type: "api_key",
    label: "Stripe Key",
    regex: /\b((?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,})\b/g,
    maskReplacement: (m) => `${m.slice(0, 8)}••••••••[REDACTED_STRIPE_KEY]`
  },

  // Slack Tokens
  {
    type: "api_key",
    label: "Slack Token",
    regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,})\b/g,
    maskReplacement: () => `xox-••••••••[REDACTED_SLACK_TOKEN]`
  },

  // Hugging Face Tokens
  {
    type: "api_key",
    label: "Hugging Face Token",
    regex: /\b(hf_[a-zA-Z0-9]{34,})\b/g,
    maskReplacement: () => `hf_••••••••[REDACTED_HF_TOKEN]`
  },

  // Private Keys (RSA, EC, OpenSSH, DSA)
  {
    type: "private_key",
    label: "Private Key",
    regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
    maskReplacement: () => `[REDACTED_PRIVATE_KEY_BLOCK]`
  },

  // Database Connection Strings with Passwords
  {
    type: "connection_string",
    label: "Database Connection URI",
    regex: /\b((?:postgres|postgresql|mongodb|mongodb\+srv|mysql|redis):\/\/[a-zA-Z0-9_.-]+:[^@\s"']+@[^\s"'<>]+)\b/g,
    maskReplacement: (m) => {
      try {
        const url = new URL(m);
        url.password = "••••••••";
        return url.toString();
      } catch {
        return "[REDACTED_DATABASE_URI]";
      }
    }
  },

  // JSON Web Tokens (JWT)
  {
    type: "credential",
    label: "JWT Auth Token",
    regex: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    maskReplacement: () => `eyJ••••••••[REDACTED_JWT]`
  },

  // Explicit Password / Secret Assignments in Prompts
  {
    type: "credential",
    label: "Hardcoded Password / Secret",
    regex: /(?:password|client_secret|api_secret|auth_token)\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
    maskReplacement: (m) => m.replace(/[:=]\s*["'].*?["']/, '="••••••••[REDACTED]"')
  }
];

/**
 * Audits a given text for sensitive keys, tokens, or credentials.
 */
export function scanSecurity(text?: string): SecurityAuditResult {
  if (!text || typeof text !== "string") {
    return {
      isSecure: true,
      findings: [],
      totalSecrets: 0,
      riskLevel: "safe"
    };
  }

  const findings: SecurityFinding[] = [];
  let totalSecrets = 0;

  for (const rule of SECURITY_RULES) {
    const matches = text.match(rule.regex);
    if (matches && matches.length > 0) {
      const uniqueMatches = Array.from(new Set(matches));
      const count = matches.length;
      totalSecrets += count;

      const sample = uniqueMatches[0];
      const snippet = sample.length > 20 ? `${sample.slice(0, 8)}...${sample.slice(-4)}` : sample;

      findings.push({
        type: rule.type,
        label: rule.label,
        snippet,
        count
      });
    }
  }

  let riskLevel: SecurityAuditResult["riskLevel"] = "safe";
  if (totalSecrets > 0) {
    riskLevel = findings.some((f) => f.type === "private_key" || f.type === "connection_string")
      ? "high"
      : "medium";
  }

  return {
    isSecure: totalSecrets === 0,
    findings,
    totalSecrets,
    riskLevel
  };
}

/**
 * Sanitizes and redacts all detected sensitive credentials,
 * preserving markdown formatting and context structure.
 */
export function redactSensitiveData(text: string): {
  sanitized: string;
  redactedCount: number;
} {
  if (!text) return { sanitized: "", redactedCount: 0 };

  let sanitized = text;
  let redactedCount = 0;

  for (const rule of SECURITY_RULES) {
    const matches = sanitized.match(rule.regex);
    if (matches && matches.length > 0) {
      redactedCount += matches.length;
      sanitized = sanitized.replace(rule.regex, (m) => rule.maskReplacement(m));
    }
  }

  return {
    sanitized,
    redactedCount
  };
}

/**
 * Defends against prototype pollution when parsing untrusted imported JSON.
 */
export function sanitizeParsedObject<T>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeParsedObject(item)) as unknown as T;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    if (typeof value === "object" && value !== null) {
      cleanObj[key] = sanitizeParsedObject(value);
    } else if (typeof value === "string") {
      cleanObj[key] = value.length > 1_000_000 ? value.slice(0, 1_000_000) : value;
    } else {
      cleanObj[key] = value;
    }
  }

  return cleanObj as T;
}

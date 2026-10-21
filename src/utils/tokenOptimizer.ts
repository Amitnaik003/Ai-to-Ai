import type { CapsuleMessage, PlatformType } from "../types";

// High-speed token estimation cache to prevent redundant recalculation on re-renders
const tokenCache = new Map<string, number>();
const MAX_CACHE_SIZE = 500;

/**
 * Fast and accurate token count estimation for modern LLMs (GPT-4o, Claude 3.5, Gemini 1.5).
 * Standard rule of thumb: ~4 characters or ~0.75 words per token in English,
 * with adjustments for code, whitespace, and special punctuation.
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.length === 0) return 0;

  if (text.length < 2000 && tokenCache.has(text)) {
    return tokenCache.get(text)!;
  }

  // Split by whitespace and punctuation clusters
  const tokens = text
    .trim()
    .split(/(\s+|[^\s\w]+|\w+)/)
    .filter(Boolean);

  let count = 0;
  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      count += Math.max(1, Math.floor(token.length / 4));
    } else if (/^[a-zA-Z0-9_]+$/.test(token)) {
      count += Math.max(1, Math.ceil(token.length / 4));
    } else {
      count += Math.max(1, Math.ceil(token.length / 2));
    }
  }

  const result = Math.max(1, Math.round(count * 0.82));

  if (text.length < 2000) {
    if (tokenCache.size >= MAX_CACHE_SIZE) {
      const firstKey = tokenCache.keys().next().value;
      if (firstKey) tokenCache.delete(firstKey);
    }
    tokenCache.set(text, result);
  }

  return result;
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k tokens`;
  }
  return `${tokens} tokens`;
}

/**
 * Conversational filler & sycophantic phrases produced by LLMs (ChatGPT, Claude, Gemini).
 * Stripping these saves substantial prompt tokens without altering semantic instructions.
 */
const FILLER_PATTERNS = [
  // Sycophancy & Greetings
  /^(?:great\s+question|that(?:'s|\s+is)\s+a\s+(?:great|wonderful|fantastic|good|fascinating)\s+(?:question|point|topic|inquiry))[,!.]?\s*/gim,
  /^(?:thank\s+you\s+for\s+(?:reaching\s+out|asking|providing\s+(?:all\s+)?the\s+details))[,!.]?\s*/gim,
  /^(?:hello|hi|hey|greetings|good\s+(?:morning|afternoon|evening))[,!.]?\s*/gim,
  /^(?:certainly|sure|absolutely|of\s+course|gladly|definitely|no\s+problem)[!.,]\s*(?:i(?:'d|\s+would)?\s+be\s+happy\s+to\s+help(?:\s+you)?(?:\s+with\s+that)?[:.]?)?\s*/gim,
  /^(?:here\s+is|here\s+are|below\s+is|below\s+are)\s+(?:the|your)?\s*(?:requested|updated|complete|following)?\s*(?:code|summary|explanation|solution|details|response|answer)?[:.]?\s*/gim,
  /^i\s+understand\s+(?:that\s+)?you\s+(?:want|need|are\s+looking\s+for)[:.]?\s*/gim,

  // Disclaimers & Model self-references
  /^(?:as\s+(?:an\s+)?ai(?:\s+language\s+model)?|i\s+am\s+(?:an\s+)?ai(?:\s+language\s+model)?)[,.]?\s*(?:i\s+(?:cannot|can't|don't|do\s+not)\s+have\s+(?:feelings|personal\s+opinions|real-time\s+data)[^.\n]*[.\n]?)?/gim,
  /^(?:it(?:'s|\s+is)\s+important\s+to\s+(?:note|remember|keep\s+in\s+mind)\s+that\s+as\s+an\s+ai[^.\n]*[.\n]?)/gim,

  // Outros & Pleasantries
  /(?:i\s+)?hope\s+this\s+helps[!.]?(?:\s+let\s+me\s+know\s+if\s+you\s+(?:have\s+(?:any\s+)?questions|need\s+(?:further\s+)?help)[!.]?)?$/gim,
  /(?:please\s+)?feel\s+free\s+to\s+ask\s+if\s+you\s+(?:have\s+(?:any\s+)?questions|need\s+(?:more\s+)?clarification)[!.]?$/gim,
  /let\s+me\s+know\s+if\s+you(?:'d|\s+would)?\s+like\s+me\s+to\s+expand\s+on\s+anything[!.]?$/gim,
  /(?:best\s+regards|sincerely|cheers|thanks|warmly),?\s*$/gim
];

export interface OptimizationResult {
  optimized: string;
  originalTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercent: number;
}

export type StructureFormatMode = 'smart_capsule' | 'xml' | 'sequence' | 'compact';

export interface StructureOptions {
  formatMode?: StructureFormatMode;
  sourcePlatform?: string;
  title?: string;
  summary?: string;
  includeHandoff?: boolean;
  aggressive?: boolean;
}

/**
 * Protect code blocks from string operations to prevent altering code indentation,
 * backticks, or code syntax.
 */
function protectCodeBlocks(text: string): { text: string; codeBlocks: string[] } {
  const codeBlocks: string[] = [];
  const protectedText = text.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });
  return { text: protectedText, codeBlocks };
}

function restoreCodeBlocks(text: string, codeBlocks: string[]): string {
  return text.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => {
    return codeBlocks[parseInt(idx, 10)] || "";
  });
}

/**
 * Strips conversational filler and cleans whitespace within a text string,
 * strictly keeping code blocks intact.
 */
export function cleanTextContent(text: string, aggressive = false): string {
  if (!text) return "";
  const { text: protectedText, codeBlocks } = protectCodeBlocks(text);

  let result = protectedText;

  // Process paragraph by paragraph to remove conversational preamble/outro
  const paragraphs = result.split(/\n{2,}/);
  const cleanedParagraphs = paragraphs
    .map((p) => {
      let cleaned = p.trim();
      for (const pattern of FILLER_PATTERNS) {
        cleaned = cleaned.replace(pattern, "").trim();
      }
      return cleaned;
    })
    .filter((p) => p.length > 0);

  result = cleanedParagraphs.join("\n\n");

  // Normalize excessive blank lines and trailing spaces
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/[ \t]+$/gm, "");
  result = result.replace(/[ \t]{2,}/g, " ");

  // Clean repeated punctuation clusters (e.g. "????" -> "?", "!!!!" -> "!")
  result = result.replace(/\?{2,}/g, "?");
  result = result.replace(/!{2,}/g, "!");

  if (aggressive) {
    // Strip redundant markdown divider rules (---, ***, ___)
    result = result.replace(/^(?:[-*_]\s*){3,}$/gm, "");
    // Collapse single newlines inside prose while respecting lists & headers
    result = result.replace(/([^\n])\n([^\n\-\*\d\.#\[<])/g, "$1 $2");
  }

  return restoreCodeBlocks(result, codeBlocks).trim();
}

/**
 * Parses raw text or conversation logs into an ordered sequence of message turns.
 * Supports markdown headers (### User), bracket tags ([User]:), role prefixes, XML tags, etc.
 */
export function parseRawTextToTurns(rawText: string): CapsuleMessage[] {
  if (!rawText || rawText.trim().length === 0) return [];

  // Match common multi-turn delimiters across LLM formats
  const turnRegex = /(?:^|\n)(?:###\s*(User|Human|You|Assistant|ChatGPT|Claude|Gemini|Bot)|\[(?:Turn\s*\d+\s*[·\-:]\s*)?(User|Assistant|Human|Claude|ChatGPT|Gemini|Bot)\]:?|<turn\s+role="([^"]+)">|(?:Turn\s*\d+\s*[-:]\s*)?(User|Assistant|Human|Claude|ChatGPT|Gemini):)\s*/gi;

  const matches: { index: number; role: "user" | "assistant"; headerLength: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = turnRegex.exec(rawText)) !== null) {
    const rawRole = (match[1] || match[2] || match[3] || match[4] || "").toLowerCase();
    const isUser = ["user", "human", "you"].includes(rawRole);
    matches.push({
      index: match.index,
      role: isUser ? "user" : "assistant",
      headerLength: match[0].length
    });
  }

  if (matches.length === 0) {
    // Single block of content
    return [{ role: "user", text: rawText.trim() }];
  }

  const turns: CapsuleMessage[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const textStart = current.index + current.headerLength;
    const textEnd = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
    let text = rawText.slice(textStart, textEnd).trim();

    // Clean any trailing XML turn closure tags
    text = text.replace(/<\/turn>$/gi, "").trim();

    if (text.length > 0) {
      turns.push({
        role: current.role,
        text
      });
    }
  }

  return turns;
}

/**
 * Extracts high-density facts, key rules, and decisions from across all turns.
 */
function extractEstablishedKnowledge(turns: CapsuleMessage[]): string[] {
  const facts: string[] = [];
  const seen = new Set<string>();

  for (const turn of turns) {
    const lines = turn.text.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Look for numbered rules, bullet points, definitions, and key takeaways
      const isFact =
        /^(\d+[\.\)]|[-*•]|Rule\s*\d*:|Note:|Step\s*\d*:|Requirement:|Key\s*Point:)/i.test(line);

      if (isFact && line.length > 15 && line.length < 280) {
        const normalized = line.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          facts.push(line);
        }
      }
    }
  }

  // Cap facts to top 25 high-leverage points to preserve token efficiency
  return facts.slice(0, 25);
}

/**
 * Extracts all fenced code blocks across all turns to guarantee zero loss of technical assets.
 */
function extractAllCodeBlocks(turns: CapsuleMessage[]): string[] {
  const codeBlocks: string[] = [];
  const seenCode = new Set<string>();

  for (const turn of turns) {
    const matches = turn.text.match(/```[\s\S]*?```/g);
    if (matches) {
      for (const block of matches) {
        const clean = block.trim();
        if (!seenCode.has(clean)) {
          seenCode.add(clean);
          codeBlocks.push(clean);
        }
      }
    }
  }
  return codeBlocks;
}

/**
 * Ultra-low token context distillation (80%–95% token savings).
 * Condenses large multi-turn conversations (e.g. 20k+ tokens) into an executive
 * context handover capsule containing:
 * 1. Initial objective / topic
 * 2. Key established rules, definitions, and guidelines
 * 3. 100% of code blocks & technical specs
 * 4. Recent dialogue boundary (last 2-3 turns)
 * 5. Direct handoff instruction for the next AI model.
 */
export function distillSmartCapsule(
  turnsOrText: CapsuleMessage[] | string,
  options: StructureOptions = {}
): OptimizationResult {
  const {
    sourcePlatform = "AI Context",
    title = "",
    summary = ""
  } = options;

  let turns: CapsuleMessage[] = [];
  let rawText = "";

  if (typeof turnsOrText === "string") {
    rawText = turnsOrText;
    turns = parseRawTextToTurns(turnsOrText);
  } else {
    turns = turnsOrText;
    rawText = turns.map((t) => `${t.role}: ${t.text}`).join("\n\n");
  }

  const originalTokens = estimateTokenCount(rawText);

  // If conversation is already short (<= 3 turns or < 1200 tokens), format cleanly
  if (turns.length <= 3 || originalTokens < 1200) {
    return buildStructuredContext(turns, {
      ...options,
      formatMode: "xml"
    });
  }

  // 1. Initial Goal / User prompt
  const initialTurn = turns[0];
  const initialObjective = cleanTextContent(initialTurn.text).slice(0, 400);

  // 2. Extract key established rules and knowledge
  const establishedFacts = extractEstablishedKnowledge(turns);

  // 3. Extract all code blocks across the chat
  const codeBlocks = extractAllCodeBlocks(turns);

  // 4. Sliding window: preserve the most recent 2-3 active turns
  const recentTurns = turns.slice(-3).map((t, idx) => ({
    role: t.role,
    text: cleanTextContent(t.text)
  }));

  // 5. Construct the ultra-compact Smart Capsule XML
  const lines: string[] = [];
  lines.push(`<context_capsule source="${sourcePlatform}"${title ? ` topic="${title.replace(/"/g, '&quot;')}"` : ""}>`);

  if (summary) {
    lines.push(`  <summary>${cleanTextContent(summary)}</summary>`);
  }

  lines.push(`  <initial_goal>`);
  lines.push(`    ${initialObjective}`);
  lines.push(`  </initial_goal>`);

  if (establishedFacts.length > 0) {
    lines.push(`  <established_rules_and_context>`);
    for (const fact of establishedFacts) {
      lines.push(`    ${fact}`);
    }
    lines.push(`  </established_rules_and_context>`);
  }

  if (codeBlocks.length > 0) {
    lines.push(`  <established_code_and_specs>`);
    for (const cb of codeBlocks) {
      lines.push(`    ${cb.replace(/\n/g, "\n    ")}`);
    }
    lines.push(`  </established_code_and_specs>`);
  }

  lines.push(`  <active_dialogue_boundary>`);
  recentTurns.forEach((turn, idx) => {
    lines.push(`    <turn role="${turn.role}">`);
    lines.push(`      ${turn.text.replace(/\n/g, "\n      ")}`);
    lines.push(`    </turn>`);
  });
  lines.push(`  </active_dialogue_boundary>`);

  lines.push(`  <handoff_directive>`);
  lines.push(`    Continue assisting the user directly on the active prompt above based on the established rules and context. Do not repeat previous answers.`);
  lines.push(`  </handoff_directive>`);
  lines.push(`</context_capsule>`);

  const optimized = lines.join("\n");
  const optimizedTokens = estimateTokenCount(optimized);
  const savedTokens = Math.max(0, originalTokens - optimizedTokens);
  const savingsPercent =
    originalTokens > 0 ? Math.round((savedTokens / originalTokens) * 100) : 0;

  return {
    optimized,
    originalTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent
  };
}

/**
 * Builds a structured, chronologically sequenced context payload with minimal token consumption.
 *
 * Supported formats:
 * 1. 'smart_capsule': Ultra-compact executive handoff (80%–95% token savings).
 * 2. 'xml': Full sequence XML tags (<context_transfer>, <dialogue_sequence>, <turn>).
 * 3. 'sequence': Clean numbered turns ([Turn 1 · User], [Turn 2 · Assistant]).
 * 4. 'compact': Minimal dialogue headers ([User]:, [Assistant]:).
 */
export function buildStructuredContext(
  turnsOrText: CapsuleMessage[] | string,
  options: StructureOptions = {}
): OptimizationResult {
  const {
    formatMode = "smart_capsule",
    sourcePlatform = "AI Context",
    title = "",
    summary = "",
    includeHandoff = true,
    aggressive = false
  } = options;

  if (formatMode === "smart_capsule") {
    return distillSmartCapsule(turnsOrText, options);
  }

  let turns: CapsuleMessage[] = [];
  let rawText = "";

  if (typeof turnsOrText === "string") {
    rawText = turnsOrText;
    turns = parseRawTextToTurns(turnsOrText);
  } else {
    turns = turnsOrText;
    rawText = turns.map((t) => `${t.role}: ${t.text}`).join("\n\n");
  }

  const originalTokens = estimateTokenCount(rawText);

  // Clean each turn's text
  const cleanedTurns = turns.map((turn) => ({
    role: turn.role,
    text: cleanTextContent(turn.text, aggressive)
  })).filter((t) => t.text.length > 0);

  let formattedOutput = "";

  if (formatMode === "xml") {
    // 2. Structured XML Context Format
    const lines: string[] = [];
    lines.push(`<context_transfer source="${sourcePlatform}"${title ? ` topic="${title.replace(/"/g, '&quot;')}"` : ""}>`);
    if (summary) {
      lines.push(`  <summary>${cleanTextContent(summary)}</summary>`);
    }
    lines.push(`  <dialogue_sequence>`);
    cleanedTurns.forEach((turn, idx) => {
      lines.push(`    <turn index="${idx + 1}" role="${turn.role}">`);
      lines.push(`      ${turn.text.replace(/\n/g, "\n      ")}`);
      lines.push(`    </turn>`);
    });
    lines.push(`  </dialogue_sequence>`);
    if (includeHandoff) {
      lines.push(`  <handoff_instruction>Continue assisting seamlessly from the latest turn above without re-answering previous steps.</handoff_instruction>`);
    }
    lines.push(`</context_transfer>`);
    formattedOutput = lines.join("\n");

  } else if (formatMode === "sequence") {
    // 3. Numbered Sequence Format
    const parts: string[] = [];
    if (title || sourcePlatform) {
      parts.push(`[CONTEXT: ${sourcePlatform.toUpperCase()}${title ? ` | ${title}` : ""}]`);
    }
    if (summary) {
      parts.push(`Summary: ${cleanTextContent(summary)}`);
    }
    parts.push("");

    cleanedTurns.forEach((turn, idx) => {
      const roleLabel = turn.role === "user" ? "User" : "Assistant";
      parts.push(`[Turn ${idx + 1} · ${roleLabel}]:\n${turn.text}`);
      parts.push("");
    });

    if (includeHandoff) {
      parts.push(`[Instruction]: Continue from the above context seamlessly.`);
    }
    formattedOutput = parts.join("\n").trim();

  } else {
    // 4. Compact Dialogue Format
    const parts: string[] = [];
    cleanedTurns.forEach((turn) => {
      const roleTag = turn.role === "user" ? "[User]:" : "[Assistant]:";
      parts.push(`${roleTag} ${turn.text}`);
    });
    formattedOutput = parts.join("\n\n").trim();
  }

  const optimizedTokens = estimateTokenCount(formattedOutput);
  const savedTokens = Math.max(0, originalTokens - optimizedTokens);
  const savingsPercent =
    originalTokens > 0 ? Math.round((savedTokens / originalTokens) * 100) : 0;

  return {
    optimized: formattedOutput,
    originalTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent
  };
}

/**
 * General purpose optimizer keeping backward compatibility with existing components
 */
export function optimizeContext(
  text: string,
  options: {
    stripFillers?: boolean;
    compactHeaders?: boolean;
    normalizeWhitespace?: boolean;
    aggressive?: boolean;
  } = {}
): OptimizationResult {
  if (!text || text.trim().length === 0) {
    return {
      optimized: "",
      originalTokens: 0,
      optimizedTokens: 0,
      savedTokens: 0,
      savingsPercent: 0
    };
  }

  const originalTokens = estimateTokenCount(text);
  const cleaned = cleanTextContent(text, options.aggressive);

  // Compact header markers
  let result = cleaned
    .replace(/###\s*(?:User|Human|You):\s*/gi, "[User]: ")
    .replace(/###\s*(?:ChatGPT|Claude|Gemini|Assistant|Bot):\s*/gi, "[Assistant]: ")
    .replace(/---\s*(?:Email\s*#?\d*|Message)\s*---\s*/gi, "[Message]: ");

  const optimized = result.trim();
  const optimizedTokens = estimateTokenCount(optimized);
  const savedTokens = Math.max(0, originalTokens - optimizedTokens);
  const savingsPercent =
    originalTokens > 0 ? Math.round((savedTokens / originalTokens) * 100) : 0;

  return {
    optimized,
    originalTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent
  };
}

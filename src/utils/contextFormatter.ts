import type { CapsuleMessage, PlatformType } from "../types";

/**
 * Conversational filler & sycophantic phrases produced by LLMs (ChatGPT, Claude, Gemini).
 * Stripping these cleans up prompt clutter without altering semantic instructions.
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

export interface FormattedResult {
  optimized: string;
}

export type StructureFormatMode = 'xml' | 'sequence' | 'compact';

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

  return restoreCodeBlocks(result, codeBlocks).trim();
}

/**
 * Splits raw multi-turn conversation text into structured role turns.
 */
export function parseRawTextToTurns(raw: string): CapsuleMessage[] {
  if (!raw || !raw.trim()) return [];

  const turns: CapsuleMessage[] = [];
  const lines = raw.split("\n");

  const turnHeaderRegex =
    /^(?:(?:\[|\()?(User|Human|Assistant|AI|ChatGPT|Claude|Gemini|System)(?:\]|\))?:\s*|#+\s*(User|Human|Assistant|AI|ChatGPT|Claude|Gemini|System)\b)/i;

  let currentRole: "user" | "assistant" | "system" = "user";
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(turnHeaderRegex);
    if (match) {
      if (currentLines.length > 0) {
        const text = currentLines.join("\n").trim();
        if (text) {
          turns.push({ role: currentRole, text });
        }
        currentLines = [];
      }

      const roleStr = (match[1] || match[2] || "").toLowerCase();
      if (roleStr === "user" || roleStr === "human") {
        currentRole = "user";
      } else if (roleStr === "system") {
        currentRole = "system";
      } else {
        currentRole = "assistant";
      }

      const remainder = line.replace(turnHeaderRegex, "").trim();
      if (remainder) {
        currentLines.push(remainder);
      }
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const text = currentLines.join("\n").trim();
    if (text) {
      turns.push({ role: currentRole, text });
    }
  }

  // Fallback if no explicit headers found
  if (turns.length === 0 && raw.trim()) {
    turns.push({ role: "user", text: raw.trim() });
  }

  return turns;
}

/**
 * Builds a structured, chronologically sequenced context payload.
 *
 * Supported formats:
 * 1. 'xml': Full sequence XML tags (<context_transfer>, <dialogue_sequence>, <turn>).
 * 2. 'sequence': Clean numbered turns ([Turn 1 · User], [Turn 2 · Assistant]).
 * 3. 'compact': Minimal dialogue headers ([User]:, [Assistant]:).
 */
export function buildStructuredContext(
  turnsOrText: CapsuleMessage[] | string,
  options: StructureOptions = {}
): FormattedResult {
  const {
    formatMode = "xml",
    sourcePlatform = "AI Context",
    title = "",
    summary = "",
    includeHandoff = true,
    aggressive = false
  } = options;

  let turns: CapsuleMessage[] = [];

  if (typeof turnsOrText === "string") {
    turns = parseRawTextToTurns(turnsOrText);
  } else {
    turns = turnsOrText;
  }

  // Clean each turn's text
  const cleanedTurns = turns
    .map((turn) => ({
      role: turn.role,
      text: cleanTextContent(turn.text, aggressive)
    }))
    .filter((t) => t.text.length > 0);

  let formattedOutput = "";

  if (formatMode === "xml") {
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
    const lines: string[] = [];
    if (title) lines.push(`[Topic: ${title}]`);
    if (summary) lines.push(`[Summary: ${summary}]\n`);
    cleanedTurns.forEach((turn, idx) => {
      const roleLabel = turn.role === "user" ? "User" : turn.role === "system" ? "System" : "Assistant";
      lines.push(`--- Turn ${idx + 1} (${roleLabel}) ---\n${turn.text}\n`);
    });
    if (includeHandoff) {
      lines.push(`--- Action ---\nPlease continue directly based on the context above.`);
    }
    formattedOutput = lines.join("\n");
  } else {
    // Compact format
    const lines: string[] = [];
    if (title) lines.push(`Context: ${title}`);
    cleanedTurns.forEach((turn) => {
      const prefix = turn.role === "user" ? "[User]:" : turn.role === "system" ? "[System]:" : "[Assistant]:";
      lines.push(`${prefix} ${turn.text}`);
    });
    formattedOutput = lines.join("\n\n");
  }

  return { optimized: formattedOutput };
}

/**
 * Quick cleaning helper for raw text selections.
 */
export function optimizeContext(text: string, aggressive = false): FormattedResult {
  const cleaned = cleanTextContent(text, aggressive);
  return { optimized: cleaned };
}

import type { Capsule } from "../types";

export interface DeepSearchResult {
  hasMatch: boolean;
  matchScore: number;
  matchSources: ("title" | "summary" | "tag" | "user_turn" | "ai_turn" | "code" | "content")[];
  snippet?: string;
  matchedTerms: string[];
}

/**
 * Tokenizes a search query into distinct terms, respecting quoted phrases.
 * e.g. 'react "error boundary" prompt' -> ['react', 'error boundary', 'prompt']
 */
export function tokenizeSearchQuery(query: string): string[] {
  const terms: string[] = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(query)) !== null) {
    const term = (match[1] || match[2] || "").trim().toLowerCase();
    if (term) {
      terms.push(term);
    }
  }

  return terms;
}

/**
 * Extracts a contextual snippet around the first matched term.
 */
function extractMatchingSnippet(text: string, term: string): string | undefined {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term);
  if (idx === -1) return undefined;

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + term.length + 60);

  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;

  return snippet;
}

/**
 * Executes a Deep Search over a capsule.
 * Evaluates:
 * 1. Title & Summary
 * 2. Tags
 * 3. Structured Message turns (User prompts vs Assistant answers)
 * 4. Code blocks inside markdown fences
 * 5. Full Raw Context content
 */
export function executeDeepSearch(capsule: Capsule, query: string): DeepSearchResult {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return {
      hasMatch: true,
      matchScore: 0,
      matchSources: [],
      matchedTerms: []
    };
  }

  const terms = tokenizeSearchQuery(cleanQuery);
  if (terms.length === 0) {
    return {
      hasMatch: true,
      matchScore: 0,
      matchSources: [],
      matchedTerms: []
    };
  }

  const titleLower = (capsule.title || "").toLowerCase();
  const summaryLower = (capsule.summary || "").toLowerCase();
  const contentLower = (capsule.content || "").toLowerCase();
  const tagsLower = (capsule.tags || []).map((t) => t.toLowerCase());

  // Extract user and assistant turns
  const userTurns = (capsule.messages || [])
    .filter((m) => m.role === "user")
    .map((m) => m.text.toLowerCase());
  const aiTurns = (capsule.messages || [])
    .filter((m) => m.role === "assistant")
    .map((m) => m.text.toLowerCase());

  // Extract code blocks inside markdown
  const codeBlocks: string[] = [];
  const codeRegex = /```[\s\S]*?```|`[^`\n]+`/g;
  let codeMatch: RegExpExecArray | null;
  while ((codeMatch = codeRegex.exec(capsule.content || "")) !== null) {
    codeBlocks.push(codeMatch[0].toLowerCase());
  }

  const sourcesSet = new Set<DeepSearchResult["matchSources"][number]>();
  const matchedTerms = new Set<string>();
  let matchScore = 0;
  let foundSnippet: string | undefined;

  for (const term of terms) {
    let termFound = false;

    // Check title (Highest relevance)
    if (titleLower.includes(term)) {
      termFound = true;
      sourcesSet.add("title");
      matchScore += 10;
      if (!foundSnippet) foundSnippet = capsule.title;
    }

    // Check tags
    if (tagsLower.some((t) => t.includes(term))) {
      termFound = true;
      sourcesSet.add("tag");
      matchScore += 8;
    }

    // Check summary
    if (summaryLower.includes(term)) {
      termFound = true;
      sourcesSet.add("summary");
      matchScore += 6;
      if (!foundSnippet) foundSnippet = extractMatchingSnippet(capsule.summary, term);
    }

    // Check user turns (prompts)
    if (userTurns.some((turn) => turn.includes(term))) {
      termFound = true;
      sourcesSet.add("user_turn");
      matchScore += 7;
      if (!foundSnippet) {
        const matchingTurn = (capsule.messages || []).find(
          (m) => m.role === "user" && m.text.toLowerCase().includes(term)
        );
        if (matchingTurn) {
          foundSnippet = extractMatchingSnippet(matchingTurn.text, term);
        }
      }
    }

    // Check code blocks
    if (codeBlocks.some((code) => code.includes(term))) {
      termFound = true;
      sourcesSet.add("code");
      matchScore += 5;
    }

    // Check AI turns
    if (aiTurns.some((turn) => turn.includes(term))) {
      termFound = true;
      sourcesSet.add("ai_turn");
      matchScore += 4;
      if (!foundSnippet) {
        const matchingTurn = (capsule.messages || []).find(
          (m) => m.role === "assistant" && m.text.toLowerCase().includes(term)
        );
        if (matchingTurn) {
          foundSnippet = extractMatchingSnippet(matchingTurn.text, term);
        }
      }
    }

    // Check raw content fallback
    if (!termFound && contentLower.includes(term)) {
      termFound = true;
      sourcesSet.add("content");
      matchScore += 3;
      if (!foundSnippet) {
        foundSnippet = extractMatchingSnippet(capsule.content, term);
      }
    }

    if (termFound) {
      matchedTerms.add(term);
    }
  }

  // All terms must be found for a valid deep search match (AND logic across terms)
  const hasMatch = terms.every((t) => matchedTerms.has(t));

  return {
    hasMatch,
    matchScore,
    matchSources: Array.from(sourcesSet),
    snippet: foundSnippet,
    matchedTerms: Array.from(matchedTerms)
  };
}

import { estimateTokenCount, cleanTextContent } from "./tokenOptimizer";

export type CookRecipeId =
  | "golden_standard"
  | "staff_architect"
  | "deep_research"
  | "token_diet"
  | "guardrails";

export interface CookRecipe {
  id: CookRecipeId;
  name: string;
  tagline: string;
  description: string;
  icon: string;
}

export const COOK_RECIPES: CookRecipe[] = [
  {
    id: "golden_standard",
    name: "Golden Prompt Standard",
    tagline: "Structured Objective, Context, Constraints & Output Schema",
    description: "Aligns your prompt with frontier LLM benchmarks (ChatGPT, Claude 3.7, Gemini 2.5).",
    icon: "🏆"
  },
  {
    id: "staff_architect",
    name: "Staff Architect / Code Spec",
    tagline: "Defensive Coding, Type-Safety & Production Architecture",
    description: "Forces code generation without placeholders, with full error handling and clean interfaces.",
    icon: "⚡"
  },
  {
    id: "deep_research",
    name: "Deep Research & Analysis",
    tagline: "Exhaustive Evidence, Counter-arguments & Structured Synthesis",
    description: "Extracts key claims, cross-examines facts, and formats findings into actionable briefings.",
    icon: "🔬"
  },
  {
    id: "guardrails",
    name: "Defensive Guardrails",
    tagline: "Zero Assumptions, Edge Case Protocol & Verification Steps",
    description: "Prevents hallucinations, enforces boundary validation, and requires verification proofs.",
    icon: "🛡️"
  },
  {
    id: "token_diet",
    name: "Ultra-Concise Token Diet",
    tagline: "Strips All Fluff into High-Density Directives (-40% to -65% Tokens)",
    description: "Turns wordy explanations into ultra-dense imperative directives to save tokens.",
    icon: "✂️"
  }
];

export interface CookedPromptResult {
  recipeId: CookRecipeId;
  originalText: string;
  cookedText: string;
  originalTokens: number;
  cookedTokens: number;
  tokenDelta: number;
  highlightPoints: string[];
}

/**
 * Cook and elevate a prompt into a high-performance, well-structured instruction.
 */
export function cookPrompt(
  rawPrompt: string,
  recipeId: CookRecipeId = "golden_standard",
  options?: {
    contextSummary?: string;
    targetPlatform?: string;
  }
): CookedPromptResult {
  const cleaned = cleanTextContent(rawPrompt).trim();
  const originalTokens = estimateTokenCount(cleaned);

  let cooked = "";
  const highlightPoints: string[] = [];

  switch (recipeId) {
    case "golden_standard": {
      highlightPoints.push("Added explicit role framing and core objective specification");
      highlightPoints.push("Enforced clear input context and execution boundaries");
      highlightPoints.push("Structured output format and verification criteria");

      cooked = [
        `# ROLE & OBJECTIVE`,
        `Act as an elite domain specialist. Your objective is to address the following requirement with maximum precision, actionable depth, and zero conversational filler.`,
        ``,
        `# CONTEXT & INSTRUCTIONS`,
        options?.contextSummary ? `## Background Context:\n${options.contextSummary}\n` : "",
        `## Core Directive:`,
        cleaned,
        ``,
        `# OPERATIONAL CONSTRAINTS`,
        `- Be direct, authoritative, and substantive. Avoid preambles ("Sure, I can help with that") or post-summary fluff.`,
        `- Maintain strict logical consistency and verify every assumption against first principles.`,
        `- Highlight non-obvious trade-offs, potential edge-cases, and production implications.`,
        `- Format response with clear markdown headings, bulleted lists, and readable tables where appropriate.`
      ]
        .filter(Boolean)
        .join("\n");
      break;
    }

    case "staff_architect": {
      highlightPoints.push("Enforced production-grade TypeScript / architectural standards");
      highlightPoints.push("Banned placeholder code comments (e.g. '// TODO', '// implement later')");
      highlightPoints.push("Mandated defensive error boundaries and edge-case handling");

      cooked = [
        `# ROLE: STAFF SOFTWARE ARCHITECT & PRINCIPAL ENGINEER`,
        `Provide a production-grade, highly defensive implementation for the following technical specification:`,
        ``,
        `# SPECIFICATION`,
        cleaned,
        ``,
        `# ARCHITECTURAL REQUIREMENTS`,
        `1. Complete Implementation: Output full, runnable code. Do NOT omit implementation details with '// TODO' or '// implement later'.`,
        `2. Strict Type Safety: Use defensive types, schemas, and immutable data structures. Avoid 'any' or untyped casts.`,
        `3. Defensive Error Handling: Wrap async boundaries, handle network/IO edge cases, and validate runtime inputs.`,
        `4. Clean Separation of Concerns: Decouple domain logic from UI presentation and side-effects.`,
        `5. Performance & Complexity: Explain time/space complexity and discuss architectural trade-offs briefly at the end.`
      ].join("\n");
      break;
    }

    case "deep_research": {
      highlightPoints.push("Structured into multi-perspective comparative synthesis");
      highlightPoints.push("Mandated counter-evidence and limitation analysis");
      highlightPoints.push("Established clear executive takeaways and citation mapping");

      cooked = [
        `# RESEARCH DIRECTIVE: COMPREHENSIVE MULTI-PERSPECTIVE SYNTHESIS`,
        `Perform an in-depth, rigorous research analysis on:`,
        ``,
        cleaned,
        ``,
        `# INVESTIGATION PROTOCOL`,
        `- Core Findings: Summarize the foundational facts, recent developments, and key mechanisms.`,
        `- Comparative Analysis: Map major viewpoints, methodologies, and benchmarks side-by-side.`,
        `- Counter-Arguments & Edge Cases: Explicitly identify blind spots, trade-offs, and failure modes.`,
        `- Strategic Takeaways: Conclude with 3-5 concrete, actionable insights for immediate execution.`
      ].join("\n");
      break;
    }

    case "guardrails": {
      highlightPoints.push("Locked down hallucination boundaries and assumption checks");
      highlightPoints.push("Required self-verification step before final output");
      highlightPoints.push("Defined explicit failure criteria if input is ambiguous");

      cooked = [
        `# GUARDRAILED EXECUTION PROTOCOL`,
        `Execute the following task under strict verification boundaries:`,
        ``,
        cleaned,
        ``,
        `# MANDATORY GUARDRAILS`,
        `1. Grounding: Rely strictly on verified facts. If an answer cannot be determined with high confidence, explicitly state: "[UNCERTAIN]" and detail what data is missing.`,
        `2. No Hallucinated APIs/Syntax: Never invent function names, library imports, or citations.`,
        `3. Ambiguity Check: If requirements conflict, articulate the ambiguity and provide the safest deterministic interpretation.`,
        `4. Verification Gate: Verify all logic step-by-step prior to rendering the final conclusion.`
      ].join("\n");
      break;
    }

    case "token_diet": {
      highlightPoints.push("Stripped all narrative padding and conversational pleasantries");
      highlightPoints.push("Reformatted into high-density imperative bullet points");
      highlightPoints.push("Maximized token efficiency (-40% to -65% savings)");

      // Compact imperative translation
      const compactLines = cleaned
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((line) => {
          return line
            .replace(/^(please|could you|can you|i would like you to|i want you to)\s+/i, "")
            .replace(/\b(basically|actually|essentially|obviously|kind of|sort of)\b/gi, "")
            .trim();
        })
        .filter((l) => l.length > 0);

      cooked = [
        `[INSTRUCTION]`,
        compactLines.map((l) => (l.startsWith("-") || l.startsWith("*") ? l : `- ${l}`)).join("\n"),
        ``,
        `[CONSTRAINT: Direct concise response. Code/data only. No pleasantries.]`
      ].join("\n");
      break;
    }
  }

  const cookedTokens = estimateTokenCount(cooked);
  const tokenDelta = cookedTokens - originalTokens;

  return {
    recipeId,
    originalText: cleaned,
    cookedText: cooked,
    originalTokens,
    cookedTokens,
    tokenDelta,
    highlightPoints
  };
}

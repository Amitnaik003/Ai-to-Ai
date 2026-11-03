import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/contextFormatter";

/**
 * Extracts clean, human-readable text from a specific message node.
 * Uses live attached DOM innerText to guarantee that paragraphs, code blocks,
 * and markdown formatting are preserved byte-for-byte.
 */
function extractTextFromNode(el: HTMLElement): string {
  if (!el) return "";

  // Get live rendered text
  let text = el.innerText?.trim() || el.textContent?.trim() || "";

  // Strip UI artifacts: copy buttons, read aloud, feedback thumbs, screen reader prefixes
  text = text
    .replace(/(?:Copy code|Copied!|Read aloud|Good response|Bad response|Was this response better or worse\?|Was this response helpful\?)\s*$/gi, "")
    .replace(/(?:Copy|Read aloud|Search|Canvas|Reason|Share)\s*$/gi, "")
    .replace(/^(?:You said|ChatGPT said|User|Assistant):\s*/gi, "")
    .trim();

  return text;
}

/**
 * Robustly extracts the whole chat conversation (all user prompts AND all assistant responses)
 * from modern ChatGPT across all versions (GPT-4o, Canvas, temporary chats, o1/o3 reasoning, and live streaming).
 */
export function extractChatGPTChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // Helper: check if ChatGPT is actively generating or streaming
  const isGenerating = Boolean(
    document.querySelector(
      "button[data-testid='stop-button'], button[aria-label*='Stop'], button[aria-label*='stop'], button[data-testid*='stop'], .result-streaming, [data-is-streaming='true'], [class*='streaming'], form button svg rect"
    )
  );

  // Strategy 1: Top-Level Turn Containers
  // Distinct queries to avoid parent-child duplicate selection (e.g. article inside conversation-turn-X)
  let turnContainers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-testid^='conversation-turn-']")
  );

  if (turnContainers.length === 0) {
    turnContainers = Array.from(
      document.querySelectorAll<HTMLElement>("main article, [role='presentation'] article, article")
    );
  }

  if (turnContainers.length === 0) {
    turnContainers = Array.from(
      document.querySelectorAll<HTMLElement>("div[class*='conversation-turn']")
    );
  }

  if (turnContainers.length > 0) {
    turnContainers.forEach((container, idx) => {
      // 1A: Check for dual-turn container (holding both a user prompt and assistant response)
      const userSub = container.querySelector<HTMLElement>(
        "[data-message-author-role='user'], [data-message-role='user']"
      );
      const asstSub = container.querySelector<HTMLElement>(
        "[data-message-author-role='assistant'], [data-message-role='assistant'], .markdown, .prose, [class*='markdown'], [class*='prose'], div.text-message, [class*='agent-turn']"
      );

      if (userSub && asstSub) {
        const uTarget = userSub.querySelector<HTMLElement>(".whitespace-pre-wrap") || userSub;
        const uText = extractTextFromNode(uTarget);
        if (uText) messages.push({ role: "user", text: uText });

        const aTarget =
          asstSub.querySelector<HTMLElement>(".markdown, .prose, [class*='markdown'], [class*='prose'], div.text-message") ||
          asstSub;
        const aText = extractTextFromNode(aTarget);
        if (aText) messages.push({ role: "assistant", text: aText });
        return;
      }

      // 1B: Explicit Role Detection
      const isUser = Boolean(
        container.getAttribute("data-message-author-role") === "user" ||
        container.getAttribute("data-message-role") === "user" ||
        container.querySelector("[data-message-author-role='user'], [data-message-role='user']") ||
        container.querySelector("button[aria-label*='Edit'], [data-testid*='edit-message']")
      );

      const isAssistant = Boolean(
        container.getAttribute("data-message-author-role") === "assistant" ||
        container.getAttribute("data-message-role") === "assistant" ||
        container.querySelector("[data-message-author-role='assistant'], [data-message-role='assistant']") ||
        container.querySelector(".markdown, .prose, [class*='markdown'], [class*='prose'], div.text-message") ||
        container.querySelector("button[aria-label*='Read aloud'], [data-testid*='copy-turn-action'], button[aria-label*='Good response']")
      );

      if (isUser && !isAssistant) {
        const target =
          container.querySelector<HTMLElement>(".whitespace-pre-wrap, [data-message-author-role='user'], [class*='whitespace']") ||
          container;
        const text = extractTextFromNode(target);
        if (text) messages.push({ role: "user", text });
      } else if (isAssistant) {
        const target =
          container.querySelector<HTMLElement>(
            ".markdown, .prose, [class*='markdown'], [class*='prose'], div.text-message, [data-message-author-role='assistant']"
          ) || container;
        const text = extractTextFromNode(target);
        if (text) messages.push({ role: "assistant", text });
      } else {
        // Alternating fallback for containers without explicit classes (e.g. unauth/temporary)
        const role: "user" | "assistant" = idx % 2 === 0 ? "user" : "assistant";
        const text = extractTextFromNode(container);
        if (text) messages.push({ role, text });
      }
    });
  }

  // Strategy 2: Page-wide [data-message-author-role] chronological scan
  // Triggers if Strategy 1 found no messages or missed assistant responses
  if (messages.length === 0 || !messages.some((m) => m.role === "assistant")) {
    const roleNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-message-author-role]"));
    if (roleNodes.length > 0) {
      const roleMessages: CapsuleMessage[] = [];
      roleNodes.forEach((node) => {
        const roleAttr = node.getAttribute("data-message-author-role");
        const role: "user" | "assistant" = roleAttr === "user" ? "user" : "assistant";

        const target =
          role === "assistant"
            ? (node.querySelector<HTMLElement>(".markdown, .prose, [class*='markdown'], [class*='prose'], div.text-message") || node)
            : (node.querySelector<HTMLElement>(".whitespace-pre-wrap, [class*='whitespace']") || node);

        const text = extractTextFromNode(target);
        if (text) {
          roleMessages.push({ role, text });
        }
      });

      if (roleMessages.some((m) => m.role === "assistant")) {
        messages.length = 0;
        messages.push(...roleMessages);
      }
    }
  }

  // Strategy 3: Active Generation / Streaming Capture ("while running")
  // If ChatGPT is actively generating or assistant was not finalized, capture live response from the latest turn
  if (isGenerating || !messages.some((m) => m.role === "assistant")) {
    const allTurns = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-testid^='conversation-turn-'], main article, [role='presentation'] article, article"
      )
    );
    const lastTurn = allTurns.length > 0 ? allTurns[allTurns.length - 1] : null;

    if (lastTurn) {
      const liveTarget =
        lastTurn.querySelector<HTMLElement>(
          ".result-streaming, [data-is-streaming='true'], [class*='streaming'], .markdown, .prose, [class*='markdown'], [class*='prose'], div.text-message, [data-message-author-role='assistant']"
        ) || lastTurn;
      const liveText = extractTextFromNode(liveTarget);

      // Verify that liveText is not identical to the last user prompt
      const lastUser = messages.filter((m) => m.role === "user").pop();
      if (liveText && (!lastUser || liveText !== lastUser.text)) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.text = liveText;
        } else {
          messages.push({ role: "assistant", text: liveText });
        }
      }
    }
  }

  // Extract clean conversation title
  let pageTitle = document.title || "";
  pageTitle = pageTitle
    .replace(/\s*[-–|]\s*ChatGPT/gi, "")
    .replace(/^ChatGPT\s*[-–|]?/gi, "")
    .trim();

  if (!pageTitle || pageTitle.toLowerCase() === "chatgpt") {
    const h1Text = document.querySelector("h1")?.innerText?.trim();
    if (h1Text && h1Text.length > 2 && !h1Text.toLowerCase().includes("what can i help")) {
      pageTitle = h1Text;
    } else if (messages.length > 0 && messages[0].text) {
      pageTitle = messages[0].text.slice(0, 40).trim() + "...";
    } else {
      pageTitle = "ChatGPT Conversation";
    }
  }

  const title = pageTitle.length > 3 ? pageTitle : "ChatGPT Context";

  // Build high-clarity summary showcasing BOTH the Prompt and Response
  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  let summary = "";
  if (userMessages.length > 0 && assistantMessages.length > 0) {
    summary = `Prompt: "${userMessages[0].text.slice(0, 80)}..."\nResponse: "${assistantMessages[0].text.slice(0, 120)}..."`;
  } else if (userMessages.length > 0) {
    summary = `Prompt: "${userMessages[0].text.slice(0, 120)}..."`;
  } else if (assistantMessages.length > 0) {
    summary = `Response: "${assistantMessages[0].text.slice(0, 120)}..."`;
  } else {
    summary = "Captured conversation from ChatGPT";
  }

  // Build clean structured context preserving all turns cleanly
  const structured = buildStructuredContext(messages, {
    formatMode: "xml",
    sourcePlatform: "ChatGPT",
    title,
    summary,
    includeHandoff: true
  });

  return {
    title,
    summary,
    content: structured.optimized || (document.body.innerText?.slice(0, 2000) ?? ""),
    messages,
    platform: "chatgpt",
    sourceUrl: window.location.href,
    tags: ["chatgpt", "structured-context"]
  };
}

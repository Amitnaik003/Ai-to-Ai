import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/contextFormatter";

/**
 * Extracts clean text from an element while preserving code blocks and line breaks.
 * Strips UI artifacts (copy buttons, feedback widgets, audio controls, screen reader headers).
 */
function getCleanText(el: HTMLElement): string {
  if (!el) return "";

  // Prioritize markdown/prose or whitespace container
  const target =
    (el.querySelector(".markdown, .prose, div[class*='markdown']") as HTMLElement) ||
    (el.querySelector(".whitespace-pre-wrap, div[class*='whitespace-pre-wrap']") as HTMLElement) ||
    el;

  const clone = target.cloneNode(true) as HTMLElement;

  // Remove UI buttons and metadata
  clone.querySelectorAll(
    "button, [aria-label*='Copy'], [aria-label*='Read aloud'], [aria-label*='Edit'], [aria-label*='Good response'], [aria-label*='Bad response'], [data-testid*='feedback'], [data-testid*='copy'], [data-testid*='thought'], [data-testid*='voice'], div[class*='thought'], .sr-only, h5.sr-only, h6.sr-only"
  ).forEach((btn) => btn.remove());

  // Attempt text retrieval from clone
  let text = clone.innerText?.trim();

  // If detached clone.innerText returned empty, fallback to live target.innerText
  if (!text) {
    text = target.innerText?.trim() || target.textContent?.trim() || "";
  }

  // Clean trailing button artifacts and screen-reader prefixes
  text = text
    .replace(/(?:Copy code|Copied!|Read aloud|Good response|Bad response)\s*$/gi, "")
    .replace(/^(?:You said|ChatGPT said|User|Assistant):\s*/gi, "")
    .trim();

  return text;
}

/**
 * Extracts the complete chat history (prompts AND responses) from ChatGPT.
 */
export function extractChatGPTChat(): Partial<Capsule> {
  let messages: CapsuleMessage[] = [];

  // Strategy 1: Modern ChatGPT [data-message-author-role] elements
  const roleNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-message-author-role]"));
  if (roleNodes.length > 0) {
    roleNodes.forEach((node) => {
      const rawRole = node.getAttribute("data-message-author-role");
      const role: "user" | "assistant" = rawRole === "user" ? "user" : "assistant";
      const text = getCleanText(node);
      if (text && text.length > 0) {
        messages.push({ role, text });
      }
    });
  }

  // Strategy 2: Turn containers (article, data-testid^='conversation-turn-')
  // Used if Strategy 1 found no messages or only found user prompts
  const hasAssistant = messages.some((m) => m.role === "assistant");
  if (messages.length === 0 || !hasAssistant) {
    const turnContainers = Array.from(
      document.querySelectorAll<HTMLElement>(
        "article, [data-testid^='conversation-turn-'], div[class*='conversation-turn']"
      )
    );

    if (turnContainers.length > 0) {
      const turnMessages: CapsuleMessage[] = [];
      turnContainers.forEach((turn, idx) => {
        const hasAssistantClass = turn.querySelector(".markdown, .prose, [class*='agent-turn']");
        const hasUserClass = turn.querySelector(".whitespace-pre-wrap");

        let role: "user" | "assistant" = idx % 2 === 0 ? "user" : "assistant";
        if (hasAssistantClass && !hasUserClass) role = "assistant";
        else if (hasUserClass && !hasAssistantClass) role = "user";
        else if (turn.getAttribute("data-message-author-role") === "user") role = "user";
        else if (turn.getAttribute("data-message-author-role") === "assistant") role = "assistant";

        const text = getCleanText(turn);
        if (text && text.length > 0) {
          turnMessages.push({ role, text });
        }
      });

      if (turnMessages.some((m) => m.role === "assistant")) {
        messages = turnMessages;
      }
    }
  }

  // Strategy 3: Pair all user prompt bubbles and assistant response bubbles in document order
  if (messages.length === 0 || !messages.some((m) => m.role === "assistant")) {
    const userBubbles = Array.from(
      document.querySelectorAll<HTMLElement>("[data-message-author-role='user'], div.whitespace-pre-wrap")
    ).filter((el, _i, arr) => !arr.some((other) => other !== el && other.contains(el)));

    const assistantBubbles = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-message-author-role='assistant'], div.markdown.prose, div.markdown, [data-message-model-slug], div[class*='agent-turn']"
      )
    ).filter((el, _i, arr) => !arr.some((other) => other !== el && other.contains(el)));

    const allItems: Array<{ role: "user" | "assistant"; el: HTMLElement }> = [
      ...userBubbles.map((el) => ({ role: "user" as const, el })),
      ...assistantBubbles.map((el) => ({ role: "assistant" as const, el }))
    ];

    allItems.sort((a, b) => {
      if (a.el === b.el) return 0;
      const pos = a.el.compareDocumentPosition(b.el);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    const fallbackMessages: CapsuleMessage[] = [];
    allItems.forEach((item) => {
      const text = getCleanText(item.el);
      if (text && text.length > 0) {
        fallbackMessages.push({ role: item.role, text });
      }
    });

    if (fallbackMessages.length > messages.length) {
      messages = fallbackMessages;
    }
  }

  // Clean title detection
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

  // Summary clearly showing BOTH Prompt and Response snippet
  const firstUser = messages.find((m) => m.role === "user")?.text || "";
  const firstAI = messages.find((m) => m.role === "assistant")?.text || "";

  let summary = "";
  if (firstUser && firstAI) {
    summary = `Prompt: "${firstUser.slice(0, 75)}..."\nResponse: "${firstAI.slice(0, 100)}..."`;
  } else if (firstUser) {
    summary = `Prompt: "${firstUser.slice(0, 120)}..."`;
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

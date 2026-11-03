import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/contextFormatter";

/**
 * Cleanly extracts text from a ChatGPT message DOM element.
 * Strips out action buttons, screen reader labels, feedback icons, and reasoning blocks.
 */
function extractCleanNodeText(node: HTMLElement, role: "user" | "assistant" | "system"): string {
  // If assistant, prioritize targeting the formatted markdown container
  const target =
    role === "assistant"
      ? (node.querySelector(".markdown, .prose, [class*='markdown']") as HTMLElement) || node
      : (node.querySelector(".whitespace-pre-wrap, [class*='whitespace-pre-wrap']") as HTMLElement) || node;

  const clone = target.cloneNode(true) as HTMLElement;

  // Remove UI artifacts: copy buttons, edit icons, feedback widgets, voice controls, thoughts, and screen-reader only headers
  const noiseSelectors = [
    "button",
    "[aria-label*='Copy']",
    "[aria-label*='Read aloud']",
    "[aria-label*='Edit']",
    "[aria-label*='Good response']",
    "[aria-label*='Bad response']",
    "[data-testid*='feedback']",
    "[data-testid*='copy']",
    "[data-testid*='thought']",
    "[data-testid*='voice']",
    "div[class*='thought']",
    ".sr-only"
  ];

  clone.querySelectorAll(noiseSelectors.join(", ")).forEach((el) => el.remove());

  // In Chrome, detached innerText might be empty; fall back to textContent
  let text = clone.innerText?.trim();
  if (!text) {
    text = clone.textContent?.trim() || "";
  }

  // Strip leading screen-reader residual text if still present
  text = text
    .replace(/^(?:You said|ChatGPT said|User|Assistant):\s*/i, "")
    .trim();

  return text;
}

export function extractChatGPTChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // Strategy 1: data-message-author-role attributes (Primary ChatGPT modern standard)
  const roleNodes = document.querySelectorAll<HTMLElement>("[data-message-author-role]");

  if (roleNodes.length > 0) {
    roleNodes.forEach((node) => {
      const rawRole = node.getAttribute("data-message-author-role");
      const role: "user" | "assistant" | "system" =
        rawRole === "user" ? "user" : rawRole === "assistant" ? "assistant" : "system";

      const text = extractCleanNodeText(node, role);
      if (text && text.length > 1) {
        messages.push({ role, text });
      }
    });
  }

  // Strategy 2: Article or conversation-turn container tags (ChatGPT 2024-2026 turn architecture)
  if (messages.length === 0) {
    const turnContainers = document.querySelectorAll<HTMLElement>(
      "article, [data-testid^='conversation-turn-'], div[class*='conversation-turn']"
    );

    turnContainers.forEach((turn, idx) => {
      const userIndicator =
        turn.querySelector("[data-message-author-role='user']") ||
        turn.querySelector("[data-testid*='user']") ||
        (turn.querySelector(".whitespace-pre-wrap") && !turn.querySelector(".markdown"));

      const assistantIndicator =
        turn.querySelector("[data-message-author-role='assistant']") ||
        turn.querySelector("[data-testid*='assistant']") ||
        turn.querySelector(".markdown, .prose");

      const role: "user" | "assistant" = userIndicator
        ? "user"
        : assistantIndicator
        ? "assistant"
        : idx % 2 === 0
        ? "user"
        : "assistant";

      const text = extractCleanNodeText(turn, role);
      if (text && text.length > 1) {
        messages.push({ role, text });
      }
    });
  }

  // Strategy 3: Chat bubbles fallback (Shared chat links or lightweight mobile views)
  if (messages.length === 0) {
    const bubbles = document.querySelectorAll<HTMLElement>("div.whitespace-pre-wrap, div.markdown.prose");
    bubbles.forEach((b, idx) => {
      const isUser = b.classList.contains("whitespace-pre-wrap") || idx % 2 === 0;
      const role: "user" | "assistant" = isUser ? "user" : "assistant";
      const text = extractCleanNodeText(b, role);
      if (text && text.length > 1) {
        messages.push({ role, text });
      }
    });
  }

  // Extract page or conversation title
  let pageTitle = document.title || "";
  pageTitle = pageTitle
    .replace(/\s*[-–|]\s*ChatGPT/gi, "")
    .replace(/^ChatGPT\s*[-–|]?/gi, "")
    .trim();

  // If document.title is just "ChatGPT" or empty, try grabbing the first h1 or conversational header
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
  const summary =
    messages.length > 0
      ? `Conversation with ${messages.length} messages. First prompt: ${messages[0]?.text.slice(0, 90)}...`
      : "Captured conversation from ChatGPT";

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

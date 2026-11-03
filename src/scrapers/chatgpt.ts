import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/contextFormatter";

/**
 * Cleanly extracts text from a DOM element.
 * Strips UI artifacts (buttons, feedback widgets, audio controls, screen reader headers).
 * Preserves code blocks and multi-line formatting.
 */
function extractCleanText(el: HTMLElement): string {
  if (!el) return "";

  // Get raw live text first to verify element has content
  const liveText = el.innerText || el.textContent || "";
  if (!liveText.trim()) return "";

  // Clone element to safely remove UI artifacts
  const clone = el.cloneNode(true) as HTMLElement;

  // Remove UI noise: buttons, feedback widgets, copy/audio buttons, thought accordions, sr-only tags
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
    "button[aria-expanded]",
    ".sr-only",
    "h5.sr-only",
    "h6.sr-only"
  ];

  clone.querySelectorAll(noiseSelectors.join(", ")).forEach((b) => b.remove());

  // Extract text: prefer clone innerText, fallback to live target text with cleanups
  let text = clone.innerText?.trim();
  if (!text) {
    text = clone.textContent?.trim() || liveText.trim();
  }

  // Strip common button labels and screen-reader prefixes
  text = text
    .replace(/(?:Copy code|Copied!|Read aloud|Good response|Bad response)\s*$/gi, "")
    .replace(/^(?:You said|ChatGPT said|User|Assistant):\s*/gi, "")
    .trim();

  return text;
}

/**
 * Filter elements to keep the innermost content container (avoiding parent/child duplicates).
 */
function filterInnermostContent(nodes: HTMLElement[]): HTMLElement[] {
  return nodes.filter((node, idx, arr) => {
    // If this node contains another candidate in the array, prefer the inner one
    return !arr.some((other, oIdx) => oIdx !== idx && node.contains(other));
  });
}

/**
 * Robustly extracts the full conversation (prompts AND responses) from modern ChatGPT.
 * Supports completed chats, multi-turn threads, and live generation while streaming.
 */
export function extractChatGPTChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // 1. Check if ChatGPT is currently running / streaming an answer
  const isCurrentlyStreaming = Boolean(
    document.querySelector(
      "button[aria-label*='Stop'], button[data-testid*='stop'], .result-streaming, [data-is-streaming='true']"
    )
  );

  // 2. Discover all candidate Assistant (Response) elements
  const assistantSelectors = [
    "[data-message-author-role='assistant']",
    "[data-message-author-role='model']",
    "[data-message-author-role='agent']",
    "div.result-streaming",
    "div[class*='result-streaming']",
    "div[data-is-streaming='true']",
    "div.markdown.prose",
    "div.markdown",
    "div[class*='markdown']",
    "div[data-message-model-slug]",
    "div[class*='agent-turn']",
    "[data-testid*='assistant-message']",
    "[data-testid*='conversation-turn-assistant']"
  ];

  const rawAssistantNodes = Array.from(
    document.querySelectorAll<HTMLElement>(assistantSelectors.join(", "))
  );
  const assistantElements = filterInnermostContent(rawAssistantNodes);

  // 3. Discover all candidate User (Prompt) elements
  const userSelectors = [
    "[data-message-author-role='user']",
    "div.whitespace-pre-wrap",
    "div[class*='whitespace-pre-wrap']",
    "[data-testid*='user-message']",
    "[data-testid*='conversation-turn-user']"
  ];

  const rawUserNodes = Array.from(
    document.querySelectorAll<HTMLElement>(userSelectors.join(", "))
  );
  const userElements = filterInnermostContent(rawUserNodes);

  // 4. Combine and sort all conversation turns in exact chronological order via compareDocumentPosition
  const allTurns: Array<{ role: "user" | "assistant"; element: HTMLElement }> = [];

  userElements.forEach((el) => {
    // Make sure user element doesn't contain an assistant element
    if (!assistantElements.some((a) => el.contains(a))) {
      allTurns.push({ role: "user", element: el });
    }
  });

  assistantElements.forEach((el) => {
    // Make sure assistant element doesn't contain a user element
    if (!userElements.some((u) => el.contains(u))) {
      allTurns.push({ role: "assistant", element: el });
    }
  });

  // Sort by DOM tree sequence (exact chronological conversation order)
  allTurns.sort((a, b) => {
    if (a.element === b.element) return 0;
    const pos = a.element.compareDocumentPosition(b.element);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  // Extract clean text for each turn
  allTurns.forEach((turn) => {
    const text = extractCleanText(turn.element);
    if (text && text.length > 0) {
      messages.push({ role: turn.role, text });
    }
  });

  // 5. Fallback Strategy: If no assistant responses were captured via candidate elements
  if (!messages.some((m) => m.role === "assistant")) {
    // Check turn containers (article or conversation-turn)
    const turnContainers = Array.from(
      document.querySelectorAll<HTMLElement>(
        "article, [data-testid^='conversation-turn-'], div[class*='conversation-turn']"
      )
    );

    if (turnContainers.length > 0) {
      const fallbackTurns: CapsuleMessage[] = [];
      turnContainers.forEach((turn, idx) => {
        const text = extractCleanText(turn);
        if (text && text.length > 0) {
          const isUser =
            turn.getAttribute("data-message-author-role") === "user" ||
            turn.querySelector(".whitespace-pre-wrap") !== null ||
            idx % 2 === 0;
          fallbackTurns.push({
            role: isUser ? "user" : "assistant",
            text
          });
        }
      });

      if (fallbackTurns.some((m) => m.role === "assistant")) {
        messages.length = 0;
        messages.push(...fallbackTurns);
      }
    }
  }

  // 6. Streaming Fallback: If ChatGPT is currently running / streaming and no assistant text was captured
  if (isCurrentlyStreaming && !messages.some((m) => m.role === "assistant")) {
    const streamTarget = document.querySelector<HTMLElement>(
      ".result-streaming, [data-is-streaming='true'], div[class*='streaming'], div.markdown:last-of-type"
    );
    if (streamTarget) {
      const liveStreamText = extractCleanText(streamTarget);
      if (liveStreamText) {
        messages.push({ role: "assistant", text: liveStreamText + " ⏳ (Streaming...)" });
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
    summary = `Prompt: "${userMessages[0].text.slice(0, 75)}..."\nResponse: "${assistantMessages[0].text.slice(0, 100)}..."`;
  } else if (userMessages.length > 0) {
    summary = isCurrentlyStreaming
      ? `Prompt: "${userMessages[0].text.slice(0, 100)}..." (ChatGPT is currently generating an answer...)`
      : `Prompt: "${userMessages[0].text.slice(0, 120)}..."`;
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

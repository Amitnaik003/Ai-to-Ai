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
    .replace(/(?:Copy code|Copied!|Read aloud|Good response|Bad response|Was this response better or worse\?)\s*$/gi, "")
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

  // Method 1: Inspect Conversation Turn Containers (article, [data-testid^='conversation-turn-'])
  // Modern ChatGPT groups exchanges inside conversation turn wrappers.
  const turnContainers = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-testid^='conversation-turn-'], article, div[class*='conversation-turn']"
    )
  );

  if (turnContainers.length > 0) {
    turnContainers.forEach((container) => {
      // Find User prompt node inside this container
      const userNode = container.querySelector<HTMLElement>(
        ".whitespace-pre-wrap, [data-message-author-role='user'], [data-testid*='user']"
      );

      // Find Assistant response node inside this container
      const assistantNode = container.querySelector<HTMLElement>(
        ".markdown, .prose, .result-streaming, [data-message-author-role='assistant'], [data-message-model-slug], div[class*='agent-turn']"
      );

      // If container holds both user prompt and assistant response, extract BOTH in order
      if (userNode && assistantNode) {
        const uText = extractTextFromNode(userNode);
        if (uText) messages.push({ role: "user", text: uText });

        const aText = extractTextFromNode(assistantNode);
        if (aText) messages.push({ role: "assistant", text: aText });
      } else if (userNode) {
        const uText = extractTextFromNode(userNode);
        if (uText) messages.push({ role: "user", text: uText });
      } else if (assistantNode) {
        const aText = extractTextFromNode(assistantNode);
        if (aText) messages.push({ role: "assistant", text: aText });
      } else {
        // Fallback for container without explicit classes: check role or content
        const roleAttr = container.getAttribute("data-message-author-role");
        const role: "user" | "assistant" = roleAttr === "user" ? "user" : "assistant";
        const text = extractTextFromNode(container);
        if (text) messages.push({ role, text });
      }
    });
  }

  // Method 2: Standard [data-message-author-role] query across the entire page
  // Essential if Method 1 found no messages or missed assistant responses
  if (messages.length === 0 || !messages.some((m) => m.role === "assistant")) {
    const roleNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-message-author-role]"));
    if (roleNodes.length > 0) {
      const roleMessages: CapsuleMessage[] = [];
      roleNodes.forEach((node) => {
        const roleAttr = node.getAttribute("data-message-author-role");
        const role: "user" | "assistant" = roleAttr === "user" ? "user" : "assistant";

        // For assistant, prefer inner markdown content to avoid buttons
        const contentEl =
          role === "assistant"
            ? (node.querySelector<HTMLElement>(".markdown, .prose") || node)
            : (node.querySelector<HTMLElement>(".whitespace-pre-wrap") || node);

        const text = extractTextFromNode(contentEl);
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

  // Method 3: Chronological Element Pairing via W3C compareDocumentPosition
  // Queries all user bubbles (.whitespace-pre-wrap) and all assistant response blocks (.markdown, .prose)
  if (messages.length === 0 || !messages.some((m) => m.role === "assistant")) {
    const userNodes = Array.from(document.querySelectorAll<HTMLElement>(".whitespace-pre-wrap"));
    const assistantNodes = Array.from(
      document.querySelectorAll<HTMLElement>(".markdown, .prose, .result-streaming, div[class*='agent-turn']")
    );

    if (userNodes.length > 0 || assistantNodes.length > 0) {
      const combined: Array<{ role: "user" | "assistant"; el: HTMLElement }> = [
        ...userNodes.map((el) => ({ role: "user" as const, el })),
        ...assistantNodes.map((el) => ({ role: "assistant" as const, el }))
      ];

      // Sort in exact document tree order from top to bottom
      combined.sort((a, b) => {
        if (a.el === b.el) return 0;
        const pos = a.el.compareDocumentPosition(b.el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      const paired: CapsuleMessage[] = [];
      combined.forEach((item) => {
        const text = extractTextFromNode(item.el);
        if (text) {
          paired.push({ role: item.role, text });
        }
      });

      if (paired.length > messages.length || paired.some((m) => m.role === "assistant")) {
        messages.length = 0;
        messages.push(...paired);
      }
    }
  }

  // Method 4: Live Streaming Check ("while running")
  // If ChatGPT is actively generating and the assistant response has not finalized, grab the active stream
  const isStreaming = Boolean(
    document.querySelector(
      "button[aria-label*='Stop'], button[data-testid*='stop'], .result-streaming, [data-is-streaming='true']"
    )
  );
  if (isStreaming && !messages.some((m) => m.role === "assistant")) {
    const streamTarget = document.querySelector<HTMLElement>(
      ".result-streaming, [data-is-streaming='true'], div[class*='streaming'], .markdown:last-of-type"
    );
    if (streamTarget) {
      const liveText = extractTextFromNode(streamTarget);
      if (liveText) {
        messages.push({ role: "assistant", text: liveText });
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

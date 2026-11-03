import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/contextFormatter";

/**
 * Extracts clean, human-readable text from a ChatGPT message node.
 * Uses live attached DOM innerText to guarantee that paragraphs, code blocks,
 * and markdown formatting are preserved byte-for-byte.
 */
function cleanElementText(el: HTMLElement): string {
  if (!el) return "";

  // Target the inner markdown or whitespace content container if present
  const md = el.querySelector<HTMLElement>(".markdown, .prose, [class*='markdown'], [class*='prose']");
  const ws = el.querySelector<HTMLElement>(".whitespace-pre-wrap, [class*='whitespace-pre-wrap']");
  const target = md || ws || el;

  let text = target.innerText?.trim() || target.textContent?.trim() || "";

  // Strip UI artifacts: copy buttons, read aloud, feedback thumbs, screen reader prefixes
  text = text
    .replace(/(?:Copy code|Copied!|Read aloud|Good response|Bad response|Was this response better or worse\?)\s*$/gi, "")
    .replace(/^(?:You said|ChatGPT said|User|Assistant):\s*/gi, "")
    .trim();

  return text;
}

/**
 * Robustly extracts the full conversation (both user prompts and assistant responses)
 * from ChatGPT. Supports modern ChatGPT (GPT-4o, Canvas, temporary chats, o1/o3 reasoning),
 * completed chats, and live streaming while running.
 */
export function extractChatGPTChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // Tier 1: Standard ChatGPT [data-message-author-role] elements
  // This is OpenAI's official accessibility & DOM role standard.
  const roleNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-message-author-role]"));
  if (roleNodes.length > 0) {
    roleNodes.forEach((node) => {
      const roleAttr = node.getAttribute("data-message-author-role");
      const role: "user" | "assistant" = roleAttr === "user" ? "user" : "assistant";
      const text = cleanElementText(node);
      if (text && text.length > 0) {
        messages.push({ role, text });
      }
    });
  }

  // Tier 2: Check for active streaming response ("while running")
  // While running, ChatGPT renders into .result-streaming before assigning data-message-author-role
  if (!messages.some((m) => m.role === "assistant")) {
    const streamingEl = document.querySelector<HTMLElement>(
      ".result-streaming, [data-is-streaming='true'], div[class*='streaming'], .markdown:last-of-type"
    );
    if (streamingEl) {
      const streamText = cleanElementText(streamingEl);
      if (streamText && streamText.length > 0) {
        messages.push({ role: "assistant", text: streamText });
      }
    }
  }

  // Tier 3: Conversation turn containers (article, [data-testid^='conversation-turn-'])
  if (!messages.some((m) => m.role === "assistant")) {
    const turns = Array.from(
      document.querySelectorAll<HTMLElement>("article, [data-testid^='conversation-turn-'], div[class*='conversation-turn']")
    );

    if (turns.length > 0) {
      const fallbackList: CapsuleMessage[] = [];
      turns.forEach((turn, idx) => {
        const hasAssistant = turn.querySelector(".markdown, .prose, [class*='agent-turn'], .result-streaming");
        const hasUser = turn.querySelector(".whitespace-pre-wrap");

        let role: "user" | "assistant" = idx % 2 === 0 ? "user" : "assistant";
        if (hasAssistant && !hasUser) role = "assistant";
        else if (hasUser && !hasAssistant) role = "user";
        else if (turn.getAttribute("data-message-author-role") === "user") role = "user";
        else if (turn.getAttribute("data-message-author-role") === "assistant") role = "assistant";

        const text = cleanElementText(turn);
        if (text && text.length > 0) {
          fallbackList.push({ role, text });
        }
      });

      if (fallbackList.some((m) => m.role === "assistant")) {
        messages.length = 0;
        messages.push(...fallbackList);
      }
    }
  }

  // Tier 4: Direct query of user bubbles and assistant response bubbles in DOM tree order
  if (!messages.some((m) => m.role === "assistant")) {
    const userNodes = Array.from(document.querySelectorAll<HTMLElement>(".whitespace-pre-wrap"));
    const assistantNodes = Array.from(
      document.querySelectorAll<HTMLElement>(".markdown, .prose, div[class*='markdown'], div[class*='agent-turn']")
    );

    if (userNodes.length > 0 || assistantNodes.length > 0) {
      const combined: Array<{ role: "user" | "assistant"; el: HTMLElement }> = [
        ...userNodes.map((el) => ({ role: "user" as const, el })),
        ...assistantNodes.map((el) => ({ role: "assistant" as const, el }))
      ];

      combined.sort((a, b) => {
        if (a.el === b.el) return 0;
        const pos = a.el.compareDocumentPosition(b.el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      const paired: CapsuleMessage[] = [];
      combined.forEach((item) => {
        const text = cleanElementText(item.el);
        if (text && text.length > 0) {
          paired.push({ role: item.role, text });
        }
      });

      if (paired.some((m) => m.role === "assistant")) {
        messages.length = 0;
        messages.push(...paired);
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

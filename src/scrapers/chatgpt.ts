import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/tokenOptimizer";

export function extractChatGPTChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // Selector 1: data-message-author-role (modern ChatGPT)
  const roleNodes = document.querySelectorAll("[data-message-author-role]");

  if (roleNodes.length > 0) {
    roleNodes.forEach((node) => {
      const rawRole = node.getAttribute("data-message-author-role");
      const role: "user" | "assistant" | "system" =
        rawRole === "user" ? "user" : rawRole === "assistant" ? "assistant" : "system";

      // Clone node to safely remove UI artifacts like copy buttons or feedback widgets
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("button, [aria-label*='Copy'], [data-testid*='feedback']").forEach((el) => el.remove());

      const text = clone.innerText?.trim() || "";
      if (text) {
        messages.push({ role, text });
      }
    });
  } else {
    // Fallback: conversation turns articles
    const turns = document.querySelectorAll("article");
    turns.forEach((turn, idx) => {
      const isUser = turn.querySelector("[data-message-author-role='user']") || idx % 2 === 0;
      const role = isUser ? "user" : "assistant";
      const text = (turn as HTMLElement).innerText?.trim() || "";
      if (text) {
        messages.push({ role, text });
      }
    });
  }

  const pageTitle = document.title?.replace(" - ChatGPT", "").replace("ChatGPT", "").trim() || "ChatGPT Conversation";
  const title = pageTitle.length > 5 ? pageTitle : "ChatGPT Context";
  const summary =
    messages.length > 0
      ? `Conversation with ${messages.length} messages. First prompt: ${messages[0]?.text.slice(0, 90)}...`
      : "Captured conversation from ChatGPT";

  // Build clean structured context preserving all turns while reducing token fluff
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

import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/tokenOptimizer";

export function extractDeepSeekChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // DeepSeek Chat uses chat-item or message containers
  // User messages typically contain classes like 'user' or role identifiers
  // Assistant responses contain markdown containers
  const messageBlocks = document.querySelectorAll(
    "div[class*='chat-message'], div[class*='message-container'], div[class*='msg-'], div.fbb737a4"
  );

  if (messageBlocks.length > 0) {
    messageBlocks.forEach((block) => {
      const isUser =
        block.querySelector("[class*='user'], [data-role='user']") !== null ||
        block.className.toLowerCase().includes("user") ||
        block.querySelector("svg[class*='user']") !== null;

      const role: "user" | "assistant" = isUser ? "user" : "assistant";

      const clone = block.cloneNode(true) as HTMLElement;
      // Strip action buttons, regenerate buttons, copy buttons
      clone.querySelectorAll("button, [class*='actions'], [class*='copy-button']").forEach((el) => el.remove());

      const text = clone.innerText?.trim() || "";
      if (text) {
        messages.push({ role, text });
      }
    });
  } else {
    // Fallback: standard article or alternating bubble inspection
    const articles = document.querySelectorAll("article, div[role='presentation'] div[class*='bubble']");
    articles.forEach((el, idx) => {
      const text = (el as HTMLElement).innerText?.trim();
      if (text) {
        messages.push({
          role: idx % 2 === 0 ? "user" : "assistant",
          text
        });
      }
    });
  }

  const rawTitle = document.title?.replace(" - DeepSeek", "").replace("DeepSeek", "").trim() || "DeepSeek Conversation";
  const title = rawTitle.length > 3 ? rawTitle : "DeepSeek Context";
  const summary =
    messages.length > 0
      ? `DeepSeek conversation with ${messages.length} messages. Prompt: ${messages[0]?.text.slice(0, 90)}...`
      : "Captured conversation from DeepSeek";

  const structured = buildStructuredContext(messages, {
    formatMode: "xml",
    sourcePlatform: "DeepSeek",
    title,
    summary,
    includeHandoff: true
  });

  return {
    title,
    summary,
    content: structured.optimized || (document.body.innerText?.slice(0, 2500) ?? ""),
    messages,
    platform: "deepseek",
    sourceUrl: window.location.href,
    tags: ["deepseek", "reasoning", "structured-context"]
  };
}

import type { CapsuleMessage, Capsule } from "../types";
import { distillSmartCapsule } from "../utils/tokenOptimizer";

export function extractClaudeChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // Broader approach: query text turn blocks
  const turns = document.querySelectorAll(
    "div[class*='font-user-message'], div[class*='font-claude-message'], div.contents"
  );

  if (turns.length > 0) {
    turns.forEach((turn) => {
      const isUser =
        turn.className?.includes("font-user-message") ||
        turn.getAttribute("data-author") === "user" ||
        turn.querySelector("[data-testid='user-message']");

      const role: "user" | "assistant" = isUser ? "user" : "assistant";

      const clone = turn.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("button, [aria-label*='Copy']").forEach((el) => el.remove());

      const text = clone.innerText?.trim();
      if (text && text.length > 2) {
        messages.push({ role, text });
      }
    });
  }

  // Fallback if specific classes are obfuscated
  if (messages.length === 0) {
    const bubbles = document.querySelectorAll("div[class*='leading-relaxed']");
    bubbles.forEach((b, idx) => {
      const text = (b as HTMLElement).innerText?.trim();
      if (text && text.length > 5) {
        messages.push({
          role: idx % 2 === 0 ? "user" : "assistant",
          text
        });
      }
    });
  }

  const pageTitle = document.title?.replace(" - Claude", "").replace("Claude", "").trim() || "Claude Conversation";
  const title = pageTitle.length > 3 ? pageTitle : "Claude Context";
  const summary =
    messages.length > 0
      ? `Claude chat (${messages.length} messages). First prompt: ${messages[0]?.text.slice(0, 90)}...`
      : "Captured conversation from Claude";

  // Distill into ultra-low token Smart Capsule directly on capture (saving 80%-95% tokens)
  const distilled = distillSmartCapsule(messages, {
    sourcePlatform: "Claude",
    title,
    summary
  });

  return {
    title,
    summary,
    content: distilled.optimized || (document.body.innerText?.slice(0, 2000) ?? ""),
    messages,
    platform: "claude",
    sourceUrl: window.location.href,
    tags: ["claude", "low-token-capsule"]
  };
}

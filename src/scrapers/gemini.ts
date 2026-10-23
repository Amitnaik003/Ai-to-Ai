import type { CapsuleMessage, Capsule } from "../types";
import { distillSmartCapsule } from "../utils/tokenOptimizer";

export function extractGeminiChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // Gemini specific elements
  const userQueries = document.querySelectorAll("user-query, .query-text, div[class*='user-query']");
  const modelResponses = document.querySelectorAll("model-response, message-content, div[class*='model-response']");

  // Pair up queries and responses in chronological sequence
  const maxTurns = Math.max(userQueries.length, modelResponses.length);

  for (let i = 0; i < maxTurns; i++) {
    if (userQueries[i]) {
      const qText = (userQueries[i] as HTMLElement).innerText?.trim();
      if (qText) {
        messages.push({ role: "user", text: qText });
      }
    }
    if (modelResponses[i]) {
      const clone = modelResponses[i].cloneNode(true) as HTMLElement;
      clone.querySelectorAll("button, mat-icon, [aria-label*='Copy']").forEach((el) => el.remove());
      const rText = clone.innerText?.trim();
      if (rText) {
        messages.push({ role: "assistant", text: rText });
      }
    }
  }

  // Fallback if custom elements not queryable
  if (messages.length === 0) {
    const convoContainers = document.querySelectorAll(".conversation-container, [data-test-id*='chat']");
    convoContainers.forEach((el, idx) => {
      const text = (el as HTMLElement).innerText?.trim();
      if (text) {
        messages.push({ role: idx % 2 === 0 ? "user" : "assistant", text });
      }
    });
  }

  const pageTitle = document.title?.replace(" - Gemini", "").replace("Gemini", "").trim() || "Gemini Conversation";
  const title = pageTitle.length > 3 ? pageTitle : "Gemini Context";
  const summary =
    messages.length > 0
      ? `Gemini chat (${messages.length} messages). First prompt: ${messages[0]?.text.slice(0, 90)}...`
      : "Captured conversation from Gemini";

  // Distill into ultra-low token Smart Capsule directly on capture (saving 80%-95% tokens)
  const distilled = distillSmartCapsule(messages, {
    sourcePlatform: "Gemini",
    title,
    summary
  });

  return {
    title,
    summary,
    content: distilled.optimized || (document.body.innerText?.slice(0, 2000) ?? ""),
    messages,
    platform: "gemini",
    sourceUrl: window.location.href,
    tags: ["gemini", "low-token-capsule"]
  };
}

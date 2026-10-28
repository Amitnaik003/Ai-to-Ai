import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/contextFormatter";

export function extractPerplexityChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // Perplexity displays queries and answers in distinct sections
  // Query containers typically have h1, query headers, or data-testid='thread-title'
  // Answers are within prose / markdown containers
  const threadContainers = document.querySelectorAll("[data-testid*='thread'], div.group\\/thread, div[class*='Thread_wrapper']");

  if (threadContainers.length > 0) {
    threadContainers.forEach((turn) => {
      const queryEl = turn.querySelector("h1, div.font-display, [class*='query']");
      const answerEl = turn.querySelector("div.prose, [class*='answer'], div[class*='markdown']");

      if (queryEl) {
        const text = (queryEl as HTMLElement).innerText?.trim();
        if (text) messages.push({ role: "user", text });
      }

      if (answerEl) {
        // Clone to strip citation pills [1], [2] if desired or leave clean text
        const clone = answerEl.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("button, [data-testid*='citation'], [class*='citation']").forEach((el) => el.remove());
        const text = clone.innerText?.trim();
        if (text) messages.push({ role: "assistant", text });
      }
    });
  }

  // Fallback: search all prose blocks
  if (messages.length === 0) {
    const proseBlocks = document.querySelectorAll("div.prose, div[class*='prose']");
    const queryHeadings = document.querySelectorAll("h1, h2.font-display");

    queryHeadings.forEach((h, idx) => {
      const qText = (h as HTMLElement).innerText?.trim();
      if (qText) {
        messages.push({ role: "user", text: qText });
      }
      if (proseBlocks[idx]) {
        const aText = (proseBlocks[idx] as HTMLElement).innerText?.trim();
        if (aText) {
          messages.push({ role: "assistant", text: aText });
        }
      }
    });
  }

  const rawTitle = document.title?.replace(" - Perplexity", "").replace("Perplexity", "").trim() || "Perplexity Research";
  const title = rawTitle.length > 3 ? rawTitle : "Perplexity Research Context";
  const summary =
    messages.length > 0
      ? `Perplexity thread with ${messages.length} turns. Initial query: ${messages[0]?.text.slice(0, 90)}...`
      : "Captured research context from Perplexity";

  const structured = buildStructuredContext(messages, {
    formatMode: "xml",
    sourcePlatform: "Perplexity",
    title,
    summary,
    includeHandoff: true
  });

  return {
    title,
    summary,
    content: structured.optimized || (document.body.innerText?.slice(0, 2500) ?? ""),
    messages,
    platform: "perplexity",
    sourceUrl: window.location.href,
    tags: ["perplexity", "deep-research", "structured-context"]
  };
}

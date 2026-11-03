import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/contextFormatter";

/**
 * Cleanly extracts text from a ChatGPT DOM element.
 * Strips out action buttons, screen reader labels, feedback icons, and reasoning blocks.
 * Uses an offscreen attachment to guarantee that Chrome's layout engine preserves
 * line breaks, paragraphs, and code block formatting.
 */
function extractCleanNodeText(target: HTMLElement): string {
  if (!target) return "";

  const clone = target.cloneNode(true) as HTMLElement;

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
    ".sr-only",
    "h5.sr-only",
    "h6.sr-only"
  ];

  clone.querySelectorAll(noiseSelectors.join(", ")).forEach((el) => el.remove());

  let text = "";

  // Temporarily attach to document body offscreen so Chrome computes real layout with line breaks
  try {
    if (typeof document !== "undefined" && document.body) {
      const container = document.createElement("div");
      container.style.cssText = "position: absolute; left: -9999px; top: -9999px; visibility: hidden; pointer-events: none;";
      container.appendChild(clone);
      document.body.appendChild(container);
      text = clone.innerText?.trim() || "";
      document.body.removeChild(container);
    } else {
      text = clone.innerText?.trim() || clone.textContent?.trim() || "";
    }
  } catch {
    text = clone.innerText?.trim() || clone.textContent?.trim() || "";
  }

  // Fallback to textContent if innerText returned empty
  if (!text) {
    text = clone.textContent?.trim() || "";
  }

  // Strip leading screen-reader residual text if still present
  text = text
    .replace(/^(?:You said|ChatGPT said|User|Assistant):\s*/i, "")
    .trim();

  return text;
}

/**
 * Robustly extracts the full conversation history from modern ChatGPT.
 * Preserves all user prompts and assistant responses in chronological order.
 */
export function extractChatGPTChat(): Partial<Capsule> {
  let messages: CapsuleMessage[] = [];

  // Strategy 1: Conversation turn containers (article, data-testid='conversation-turn-X')
  const turnContainers = Array.from(
    document.querySelectorAll<HTMLElement>(
      "article, [data-testid^='conversation-turn-'], div[class*='conversation-turn']"
    )
  );

  if (turnContainers.length > 0) {
    turnContainers.forEach((turn, idx) => {
      // Find assistant content first (markdown prose)
      const assistantNode = turn.querySelector<HTMLElement>(
        ".markdown, .prose, [data-message-author-role='assistant'], [data-message-model-slug], div[class*='agent-turn']"
      );

      // Find user content (whitespace-pre-wrap)
      const userNode = turn.querySelector<HTMLElement>(
        ".whitespace-pre-wrap, [data-message-author-role='user'], [data-testid*='user']"
      );

      if (assistantNode && !userNode) {
        const text = extractCleanNodeText(assistantNode);
        if (text && text.length > 1) {
          messages.push({ role: "assistant", text });
        }
      } else if (userNode && !assistantNode) {
        const text = extractCleanNodeText(userNode);
        if (text && text.length > 1) {
          messages.push({ role: "user", text });
        }
      } else if (assistantNode && userNode) {
        // Both found in same container; check order
        const pos = userNode.compareDocumentPosition(assistantNode);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
          // User comes before assistant
          const uText = extractCleanNodeText(userNode);
          if (uText) messages.push({ role: "user", text: uText });
          const aText = extractCleanNodeText(assistantNode);
          if (aText) messages.push({ role: "assistant", text: aText });
        } else {
          const aText = extractCleanNodeText(assistantNode);
          if (aText) messages.push({ role: "assistant", text: aText });
          const uText = extractCleanNodeText(userNode);
          if (uText) messages.push({ role: "user", text: uText });
        }
      } else {
        // Neither explicit class found; check role indicator or fallback to alternating turns
        const isUser =
          turn.getAttribute("data-message-author-role") === "user" ||
          idx % 2 === 0;
        const role: "user" | "assistant" = isUser ? "user" : "assistant";
        const text = extractCleanNodeText(turn);
        if (text && text.length > 1) {
          messages.push({ role, text });
        }
      }
    });
  }

  // Strategy 2: Bubble Pairing in Document Chronological Order
  // Essential if Strategy 1 found ONLY user prompts (or missed assistant responses)
  const hasAssistant = messages.some((m) => m.role === "assistant");
  if (messages.length === 0 || !hasAssistant) {
    // Collect all candidate user elements, eliminating nested descendants
    const rawUserElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-message-author-role='user'], div.whitespace-pre-wrap, [data-testid*='user']"
      )
    ).filter((el, _i, arr) => !arr.some((other) => other !== el && other.contains(el)));

    // Collect all candidate assistant elements, eliminating nested descendants
    const rawAssistantElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-message-author-role='assistant'], div.markdown.prose, div.markdown, [data-message-model-slug], div[class*='agent-turn']"
      )
    ).filter((el, _i, arr) => !arr.some((other) => other !== el && other.contains(el)));

    if (rawUserElements.length > 0 || rawAssistantElements.length > 0) {
      const allItems: Array<{ role: "user" | "assistant"; el: HTMLElement }> = [
        ...rawUserElements.map((el) => ({ role: "user" as const, el })),
        ...rawAssistantElements.map((el) => ({ role: "assistant" as const, el }))
      ];

      // Sort in exact document chronological order using W3C compareDocumentPosition
      allItems.sort((a, b) => {
        if (a.el === b.el) return 0;
        const pos = a.el.compareDocumentPosition(b.el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1; // a comes before b
        }
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1; // b comes before a
        }
        return 0;
      });

      const bubbleMessages: CapsuleMessage[] = [];
      allItems.forEach((item) => {
        const text = extractCleanNodeText(item.el);
        if (text && text.length > 1) {
          bubbleMessages.push({ role: item.role, text });
        }
      });

      // If Strategy 2 captured both user and assistant (or more content), prefer it
      if (bubbleMessages.length > messages.length || (!hasAssistant && bubbleMessages.some((m) => m.role === "assistant"))) {
        messages = bubbleMessages;
      }
    }
  }

  // Extract clean conversation title
  let pageTitle = document.title || "";
  pageTitle = pageTitle
    .replace(/\s*[-–|]\s*ChatGPT/gi, "")
    .replace(/^ChatGPT\s*[-–|]?/gi, "")
    .trim();

  // If document.title is generic, try finding h1 or conversation headline
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

  const userCount = messages.filter((m) => m.role === "user").length;
  const aiCount = messages.filter((m) => m.role === "assistant").length;

  const summary =
    messages.length > 1
      ? `Full conversation with ${messages.length} messages (${userCount} user · ${aiCount} AI). Initial topic: ${messages[0]?.text.slice(0, 90)}...`
      : messages.length === 1
      ? `Prompt directive: ${messages[0]?.text.slice(0, 100)}...`
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

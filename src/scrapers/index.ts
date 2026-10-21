import { extractChatGPTChat } from "./chatgpt";
import { extractClaudeChat } from "./claude";
import { extractGeminiChat } from "./gemini";
import { extractGmailChat } from "./gmail";
import type { Capsule, PlatformType } from "../types";

export function detectCurrentPlatform(): PlatformType {
  const host = window.location.hostname;
  if (host.includes("chatgpt.com")) return "chatgpt";
  if (host.includes("claude.ai")) return "claude";
  if (host.includes("gemini.google.com")) return "gemini";
  if (host.includes("mail.google.com")) return "gmail";
  return "other";
}

export function extractCurrentPageChat(): Partial<Capsule> {
  const platform = detectCurrentPlatform();

  switch (platform) {
    case "chatgpt":
      return extractChatGPTChat();
    case "claude":
      return extractClaudeChat();
    case "gemini":
      return extractGeminiChat();
    case "gmail":
      return extractGmailChat();
    default:
      return {
        title: document.title || "Web Context",
        summary: document.body.innerText?.slice(0, 140) || "",
        content: window.getSelection()?.toString() || document.body.innerText?.slice(0, 2000) || "",
        platform: "other",
        sourceUrl: window.location.href,
        tags: ["web-capture"]
      };
  }
}

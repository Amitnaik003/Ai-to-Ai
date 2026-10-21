import type { CapsuleMessage, Capsule } from "../types";
import { buildStructuredContext } from "../utils/tokenOptimizer";

export function extractGmailChat(): Partial<Capsule> {
  const messages: CapsuleMessage[] = [];

  // Subject line
  const subjectEl = document.querySelector("h2.hP, input[name='subjectbox']") as HTMLElement;
  const subject = (subjectEl as HTMLInputElement)?.value || subjectEl?.innerText?.trim() || "Gmail Message Thread";

  // Active email bodies in thread
  const emailBodies = document.querySelectorAll(".ii.gt div[dir='ltr'], div[role='textbox'][aria-label*='Message Body']");

  emailBodies.forEach((body) => {
    const text = (body as HTMLElement).innerText?.trim();
    if (text) {
      messages.push({
        role: "user",
        text
      });
    }
  });

  const structured = buildStructuredContext(messages, {
    formatMode: "xml",
    sourcePlatform: "Gmail",
    title: subject,
    summary: `Email thread with ${messages.length} message(s)`,
    includeHandoff: true
  });

  return {
    title: subject || "Gmail Context",
    summary:
      messages.length > 0
        ? `Email thread: "${subject}". Contains ${messages.length} message(s).`
        : "Captured email content from Gmail",
    content: structured.optimized || (document.body.innerText?.slice(0, 1500) ?? ""),
    messages,
    platform: "gmail",
    sourceUrl: window.location.href,
    tags: ["gmail", "email-thread"]
  };
}

import type { Capsule, CapsuleMessage } from "../types";

/**
 * Extracts dialogue turns from capsule messages or XML content.
 */
function extractDialogueTurns(capsule: Capsule): CapsuleMessage[] {
  if (capsule.messages && capsule.messages.length > 0) {
    return capsule.messages;
  }
  const turns: CapsuleMessage[] = [];
  if (capsule.content && capsule.content.includes("<turn")) {
    const xmlTurnRegex = /<turn\b[^>]*?\brole=["'](user|assistant|system)["'][^>]*>([\s\S]*?)<\/turn>/gi;
    let match;
    while ((match = xmlTurnRegex.exec(capsule.content)) !== null) {
      const roleStr = match[1].toLowerCase();
      const role: "user" | "assistant" | "system" =
        roleStr === "user" ? "user" : roleStr === "system" ? "system" : "assistant";
      const text = match[2].trim();
      if (text) {
        turns.push({ role, text });
      }
    }
  }
  return turns;
}

/**
 * Sanitizes a title string into a safe, clean filename.
 */
export function sanitizeFilename(name: string, fallback = "promptwarp-context"): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return sanitized || fallback;
}

/**
 * Triggers a native browser file download from in-memory content.
 * Works seamlessly in Chrome Sidepanels and Web pages without extra permissions.
 */
export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  try {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error("Failed to trigger file download:", err);
    throw new Error("Unable to save file to desktop. Please copy text manually.");
  }
}

/**
 * Converts a single capsule into clean, readable Markdown format.
 */
export function formatCapsuleToMarkdown(capsule: Capsule): string {
  const turns: CapsuleMessage[] = extractDialogueTurns(capsule);

  const lines: string[] = [];
  lines.push(`# ${capsule.title}`);
  lines.push("");
  lines.push(`- **Platform:** ${capsule.platform.toUpperCase()}`);
  lines.push(`- **Captured At:** ${new Date(capsule.createdAt).toLocaleString()}`);
  if (capsule.sourceUrl) {
    lines.push(`- **Source:** [${capsule.sourceUrl}](${capsule.sourceUrl})`);
  }
  if (capsule.tags && capsule.tags.length > 0) {
    lines.push(`- **Tags:** ${capsule.tags.map((t) => `\`#${t}\``).join(" ")}`);
  }
  lines.push("");

  if (capsule.summary) {
    lines.push(`> **Summary:** ${capsule.summary}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Conversation Dialogue");
  lines.push("");

  if (turns.length > 0) {
    turns.forEach((turn, idx) => {
      const roleIcon = turn.role === "user" ? "👤" : turn.role === "system" ? "⚙️" : "🤖";
      const roleLabel = turn.role === "user" ? "User" : turn.role === "system" ? "System Directive" : "Assistant";
      lines.push(`### ${roleIcon} Turn ${idx + 1} (${roleLabel})`);
      lines.push("");
      lines.push(turn.text);
      lines.push("");
    });
  } else {
    lines.push(capsule.content);
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Exported via PromptWarp AI Context Teleporter*`);
  return lines.join("\n");
}

/**
 * Converts multiple capsules into a consolidated Markdown document.
 */
export function formatMultipleCapsulesToMarkdown(capsules: Capsule[]): string {
  const lines: string[] = [];
  lines.push(`# PromptWarp Context Export`);
  lines.push(`*Generated on ${new Date().toLocaleString()} · ${capsules.length} Contexts*`);
  lines.push("");
  lines.push("---");
  lines.push("");

  capsules.forEach((capsule, idx) => {
    lines.push(`## ${idx + 1}. ${capsule.title}`);
    lines.push(formatCapsuleToMarkdown(capsule));
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Exports and downloads a capsule as a `.md` Markdown file.
 */
export function downloadCapsuleAsMarkdown(capsule: Capsule): void {
  const dateStr = new Date(capsule.createdAt).toISOString().slice(0, 10);
  const baseName = sanitizeFilename(capsule.title);
  const filename = `${baseName}-${dateStr}.md`;
  const markdown = formatCapsuleToMarkdown(capsule);
  triggerFileDownload(filename, markdown, "text/markdown");
}

/**
 * Exports and downloads a capsule as a `.json` file.
 */
export function downloadCapsuleAsJSON(capsule: Capsule): void {
  const dateStr = new Date(capsule.createdAt).toISOString().slice(0, 10);
  const baseName = sanitizeFilename(capsule.title);
  const filename = `${baseName}-${dateStr}.json`;
  const jsonContent = JSON.stringify(capsule, null, 2);
  triggerFileDownload(filename, jsonContent, "application/json");
}

/**
 * Downloads multiple selected capsules as a consolidated Markdown file.
 */
export function downloadBatchAsMarkdown(capsules: Capsule[]): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `promptwarp-batch-export-${dateStr}.md`;
  const markdown = formatMultipleCapsulesToMarkdown(capsules);
  triggerFileDownload(filename, markdown, "text/markdown");
}

/**
 * Downloads multiple selected capsules as a JSON backup array.
 */
export function downloadBatchAsJSON(capsules: Capsule[]): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `promptwarp-batch-export-${dateStr}.json`;
  const jsonContent = JSON.stringify({ version: "1.0", exportedAt: new Date().toISOString(), capsules }, null, 2);
  triggerFileDownload(filename, jsonContent, "application/json");
}

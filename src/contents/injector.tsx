import React, { useState } from "react";
import type { PlasmoCSConfig } from "plasmo";
import { findActivePromptInput, injectTextIntoElement } from "../injector";
import { extractCurrentPageChat, detectCurrentPlatform } from "../scrapers";
import { CapsuleStore } from "../storage/capsuleStore";
import { buildStructuredContext } from "../utils/contextFormatter";
import { Sparkles, ArrowRight, X } from "lucide-react";

export const config: PlasmoCSConfig = {
  matches: [
    "https://chatgpt.com/*",
    "https://*.chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://perplexity.ai/*",
    "https://*.perplexity.ai/*",
    "https://chat.deepseek.com/*",
    "https://mail.google.com/*"
  ]
};

// Listen to messages from background and sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INJECT_CONTEXT") {
    const text = message.payload?.text;
    if (!text) {
      sendResponse({ success: false, message: "No text payload provided" });
      return true;
    }

    const inputEl = findActivePromptInput();
    if (!inputEl) {
      sendResponse({
        success: false,
        message: "No active input or prompt field found on this page. Please click into the chat box first."
      });
      return true;
    }

    const ok = injectTextIntoElement(inputEl, text);
    sendResponse({ success: ok, message: ok ? "Successfully injected context" : "Failed to inject" });
    return true;
  }

  if (message.type === "TRIGGER_DOM_CAPTURE") {
    try {
      const extracted = extractCurrentPageChat();
      sendResponse({ success: true, capsule: extracted });
    } catch (err: any) {
      sendResponse({ success: false, message: err?.message || "DOM extraction failed" });
    }
    return true;
  }
});

// Support Drag-and-Drop injection from Sidepanel / Library
if (typeof window !== "undefined") {
  window.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types.includes("application/x-capsule-hub")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });

  window.addEventListener("drop", (e) => {
    const rawCapsule = e.dataTransfer?.getData("application/x-capsule-hub");
    const rawText = e.dataTransfer?.getData("text/plain");
    const textToInject = rawCapsule ? JSON.parse(rawCapsule).content : rawText;

    if (textToInject) {
      e.preventDefault();
      const inputEl = findActivePromptInput();
      if (inputEl) {
        injectTextIntoElement(inputEl, textToInject);
      }
    }
  });
}

/**
 * Floating Capsule Widget on ChatGPT / Claude / Gemini / Perplexity / DeepSeek / Gmail
 */
export default function FloatingCapsuleWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const platform = detectCurrentPlatform();

  const handleCapture = async () => {
    setStatus("Extracting...");
    try {
      const extracted = extractCurrentPageChat();
      const rawContent = extracted.content || "";
      
      // Preserve full conversation sequence in clean structured format
      const structured = buildStructuredContext(extracted.messages || rawContent, {
        formatMode: "xml",
        sourcePlatform: platform.toUpperCase(),
        title: extracted.title || "Quick Capture",
        summary: extracted.summary || "Conversation capture",
        includeHandoff: true
      });
      const content = structured.optimized || rawContent;

      const saved = await CapsuleStore.saveCapsule({
        id: `cap-${Date.now()}`,
        title: extracted.title || "Quick Capture",
        summary: extracted.summary || "Conversation capture",
        content,
        messages: extracted.messages,
        platform: extracted.platform || platform,
        sourceUrl: window.location.href,
        tags: [platform, "structured-context"],
        isPinned: false,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setStatus("Saved Structured Capsule!");
      setTimeout(() => {
        setStatus(null);
        setIsOpen(false);
      }, 2500);
    } catch (err: any) {
      setStatus("Extraction failed");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleOpenSidePanel = () => {
    chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" });
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 999999,
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
      }}
    >
      {isOpen ? (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
            border: "1px solid #e2e8f0",
            padding: "12px",
            width: "240px",
            color: "#1e293b",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "6px",
                  background: "#4f46e5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff"
                }}
              >
                <Sparkles size={12} />
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>Capsule Hub</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "2px",
                color: "#94a3b8"
              }}
            >
              <X size={14} />
            </button>
          </div>

          {status ? (
            <div
              style={{
                padding: "8px",
                borderRadius: "8px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontSize: "11px",
                fontWeight: 600,
                textAlign: "center"
              }}
            >
              {status}
            </div>
          ) : (
            <>
              <button
                onClick={handleCapture}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
              >
                <Sparkles size={12} />
                <span>Capture Chat Context</span>
              </button>

              <button
                onClick={handleOpenSidePanel}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  color: "#475569",
                  fontSize: "11px",
                  fontWeight: 500,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer"
                }}
              >
                <span>Open Library Panel</span>
                <ArrowRight size={12} />
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          title="Capsule Hub - Context Transfer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff",
            boxShadow: "0 4px 16px 0 rgba(79, 70, 229, 0.45)",
            border: "2px solid #ffffff",
            cursor: "pointer",
            transition: "transform 0.2s, box-shadow 0.2s"
          }}
        >
          <Sparkles size={18} />
        </button>
      )}
    </div>
  );
}

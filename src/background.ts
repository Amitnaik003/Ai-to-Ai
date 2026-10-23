import { CapsuleStore } from "./storage/capsuleStore";
import type { PlatformType } from "./types";
import { optimizeContext, distillSmartCapsule } from "./utils/tokenOptimizer";

// Configure side panel to open on extension action icon click
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.warn("Failed to set openPanelOnActionClick:", err));
  }

  // Create context menus for instant capture
  chrome.contextMenus.create({
    id: "capsule-save-selection",
    title: "Save Selection to Capsule Hub",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "capsule-capture-page",
    title: "Capture Entire LLM Chat to Capsule Hub",
    contexts: ["page"],
    documentUrlPatterns: [
      "*://chatgpt.com/*",
      "*://*.chatgpt.com/*",
      "*://claude.ai/*",
      "*://gemini.google.com/*",
      "*://mail.google.com/*"
    ]
  });
});

function detectPlatformFromUrl(url?: string): PlatformType {
  if (!url) return "other";
  if (url.includes("chatgpt.com")) return "chatgpt";
  if (url.includes("claude.ai")) return "claude";
  if (url.includes("gemini.google.com")) return "gemini";
  if (url.includes("mail.google.com")) return "gmail";
  return "other";
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "capsule-save-selection" && info.selectionText) {
    const platform = detectPlatformFromUrl(tab?.url);
    const title = tab?.title ? `Selection from ${tab.title.slice(0, 35)}...` : "Quick Capture";
    const optimized = optimizeContext(info.selectionText);
    const content = optimized.optimized || info.selectionText;

    await CapsuleStore.saveCapsule({
      id: `cap-${Date.now()}`,
      title,
      summary: content.slice(0, 140) + (content.length > 140 ? "..." : ""),
      content,
      platform,
      sourceUrl: tab?.url,
      tags: ["quick-capture", platform],
      isPinned: false,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (tab?.id && chrome.sidePanel?.open) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    }
  }

  if (info.menuItemId === "capsule-capture-page" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_DOM_CAPTURE" }, async (response) => {
      if (chrome.runtime.lastError) {
        console.warn("Content script not ready or not matched:", chrome.runtime.lastError.message);
        return;
      }
      if (response?.success && response?.capsule) {
        const platform = response.capsule.platform || detectPlatformFromUrl(tab.url);
        const rawContent = response.capsule.content || "";
        const distilled = distillSmartCapsule(response.capsule.messages || rawContent, {
          sourcePlatform: platform.toUpperCase(),
          title: response.capsule.title || "Full Chat Capture",
          summary: response.capsule.summary || "Captured conversation"
        });
        const content = distilled.optimized || rawContent;

        await CapsuleStore.saveCapsule({
          id: `cap-${Date.now()}`,
          title: response.capsule.title || "Full Chat Capture",
          summary: response.capsule.summary || "Captured conversation",
          content,
          messages: response.capsule.messages,
          platform,
          sourceUrl: tab.url,
          tags: [platform, "low-token-capsule"],
          isPinned: false,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        if (chrome.sidePanel?.open) {
          chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
        }
      }
    });
  }
});

// Relay messages if needed between side panel and active tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_SIDEPANEL" && sender.tab?.id) {
    if (chrome.sidePanel?.open) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }
});

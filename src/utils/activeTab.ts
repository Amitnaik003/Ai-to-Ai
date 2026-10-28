/**
 * Sends a message to the currently active tab in the current window.
 */
export async function sendMessageToActiveTab(message: any): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    if (!chrome?.tabs?.query) {
      return { success: false, error: "Chrome tabs API not available." };
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      return { success: false, error: "No active tab found." };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(activeTab.id!, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message || "Failed to communicate with tab."
          });
        } else {
          resolve({ success: true, response });
        }
      });
    });
  } catch (err: any) {
    return { success: false, error: err.message || "Unexpected error dispatching message." };
  }
}

/**
 * Injects capsule content into the active LLM input box or editor
 */
export async function injectCapsuleIntoActiveTab(text: string): Promise<{ success: boolean; error?: string }> {
  const result = await sendMessageToActiveTab({
    type: "INJECT_CONTEXT",
    payload: { text }
  });

  if (!result.success) {
    // If content script is not yet injected or user is on non-target page
    return {
      success: false,
      error: result.error?.includes("Receiving end does not exist")
        ? "Target page does not have AI to AI script loaded. Please refresh the tab or navigate to ChatGPT, Claude, Gemini, Perplexity, DeepSeek, or Gmail."
        : result.error
    };
  }

  if (result.response && !result.response.success) {
    return { success: false, error: result.response.message || "Could not find prompt input field on active page." };
  }

  return { success: true };
}

/**
 * Triggers full chat extraction from the active tab
 */
export async function triggerActiveTabCapture(): Promise<{ success: boolean; capsule?: any; error?: string }> {
  const result = await sendMessageToActiveTab({
    type: "TRIGGER_DOM_CAPTURE"
  });

  if (!result.success) {
    return {
      success: false,
      error: "Active tab does not support automated chat capture or needs to be refreshed."
    };
  }

  return { success: true, capsule: result.response?.capsule };
}

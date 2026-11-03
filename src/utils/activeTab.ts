/**
 * Sends a message to the currently active tab in the current window.
 * If the content script is not yet injected (e.g. tab was opened before extension was loaded/reloaded),
 * automatically attempts programmatic injection via chrome.scripting.executeScript.
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

    const tabId = activeTab.id;

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, async (response) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || "";

          // Check if failure is due to missing content script in already-opened tab
          if (
            errMsg.includes("Receiving end does not exist") ||
            errMsg.includes("Could not establish connection")
          ) {
            try {
              const manifest = chrome.runtime.getManifest();
              const scriptFiles = manifest.content_scripts?.[0]?.js;
              if (scriptFiles && scriptFiles.length > 0 && chrome.scripting?.executeScript) {
                await chrome.scripting.executeScript({
                  target: { tabId },
                  files: scriptFiles
                });

                // Short delay for message listeners to register
                await new Promise((r) => setTimeout(r, 200));

                // Retry dispatching the message
                chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
                  if (chrome.runtime.lastError) {
                    resolve({
                      success: false,
                      error: "Could not establish connection. Please refresh the page once."
                    });
                  } else {
                    resolve({ success: true, response: retryResponse });
                  }
                });
                return;
              }
            } catch (injectErr: any) {
              // Fall through to original error report
            }
          }

          resolve({
            success: false,
            error: errMsg || "Failed to communicate with tab."
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
    return {
      success: false,
      error: result.error?.includes("Receiving end does not exist")
        ? "Target page does not have PromptWarp script loaded. Please refresh the tab or navigate to ChatGPT, Claude, Gemini, Perplexity, DeepSeek, or Gmail."
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
      error: result.error || "Active tab does not support automated chat capture or needs to be refreshed."
    };
  }

  return { success: true, capsule: result.response?.capsule };
}

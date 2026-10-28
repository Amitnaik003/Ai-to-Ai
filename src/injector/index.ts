/**
 * Finds the active prompt input or rich-text editor on the page.
 * Supports Shadow DOM piercing for Web Components (Gemini) and nested frames.
 */
export function findActivePromptInput(): HTMLElement | null {
  function searchRoot(root: Document | ShadowRoot): HTMLElement | null {
    const selectors = [
      // ChatGPT (Lexical & Textarea)
      "#prompt-textarea",
      "div#prompt-textarea[contenteditable='true']",
      "div[data-placeholder][contenteditable='true']",
      "div[contenteditable='true'][id='prompt-textarea']",

      // Claude (ProseMirror)
      "div.ProseMirror[contenteditable='true']",
      "div[contenteditable='true'][aria-label*='Claude']",
      "div[contenteditable='true'][aria-label*='Prompt']",

      // Gemini (Quill / Custom rich-textarea)
      "rich-textarea div[contenteditable='true']",
      "div.ql-editor[contenteditable='true']",
      "div[contenteditable='true'][aria-label*='Gemini']",
      "div[contenteditable='true'][aria-label*='prompt']",

      // Perplexity
      "textarea[placeholder*='Ask anything']",
      "textarea[placeholder*='Ask follow-up']",
      "textarea[placeholder*='Search']",

      // DeepSeek
      "#chat-input",
      "textarea[placeholder*='DeepSeek']",
      "textarea[placeholder*='Send a message']",
      "textarea[placeholder*='Ask me anything']",

      // Gmail
      "div[role='textbox'][aria-label*='Message Body']",
      "div[role='textbox'][g_editable='true']",

      // Generic LLM & Web App fallbacks
      "textarea[placeholder*='Message']",
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='prompt']",
      "textarea",
      "div[contenteditable='true']"
    ];

    for (const sel of selectors) {
      const el = root.querySelector(sel) as HTMLElement;
      if (el && el.offsetParent !== null) {
        return el;
      }
    }

    // Traverse shadow roots for Web Components (e.g. Gemini <rich-textarea>)
    const shadowHosts = root.querySelectorAll("rich-textarea, chat-window, [data-shadow]");
    for (const host of shadowHosts) {
      if (host.shadowRoot) {
        const found = searchRoot(host.shadowRoot);
        if (found) return found;
      }
    }

    return null;
  }

  // 1. Try search across document and shadow DOM
  const found = searchRoot(document);
  if (found) return found;

  // 2. Active element fallback if user has already focused the input
  const active = document.activeElement as HTMLElement;
  if (
    active &&
    (active.tagName === "TEXTAREA" ||
      active.tagName === "INPUT" ||
      active.getAttribute("contenteditable") === "true")
  ) {
    return active;
  }

  return null;
}

/**
 * Robustly injects text into modern React, Vue, Lexical, and ProseMirror inputs.
 * Bypasses synthetic event suppression and updates internal framework state.
 */
export function injectTextIntoElement(target: HTMLElement, text: string): boolean {
  try {
    target.focus();

    // Strategy 1: Rich Text / ContentEditable (ChatGPT Lexical, Claude ProseMirror, Gemini Quill)
    if (target.isContentEditable || target.getAttribute("contenteditable") === "true") {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false); // caret at end of current content
      selection?.removeAllRanges();
      selection?.addRange(range);

      let success = false;
      try {
        success = document.execCommand("insertText", false, text);
      } catch {
        success = false;
      }

      if (!success || !target.innerText.includes(text.slice(0, 10))) {
        // Fallback: Dispatch synthetic BeforeInput
        try {
          const beforeInputEvent = new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: text
          });
          target.dispatchEvent(beforeInputEvent);
        } catch {}

        // Append text node directly into range
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      // Notify modern framework state trackers
      target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    // Strategy 2: HTMLTextAreaElement / HTMLInputElement
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const currentVal = target.value;
      const newVal = currentVal ? `${currentVal}\n\n${text}` : text;

      // Reset React 16-19 internal value tracker to guarantee onChange triggers
      const tracker = (target as any)._valueTracker;
      if (tracker) {
        tracker.setValue("");
      }

      // Bypass prototype descriptor to update value attribute directly
      const proto = Object.getPrototypeOf(target);
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

      if (nativeSetter) {
        nativeSetter.call(target, newVal);
      } else {
        target.value = newVal;
      }

      // Dispatch input & change events
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
      target.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " " }));
      return true;
    }

    return false;
  } catch (err) {
    console.error("AI to AI injection failed:", err);
    return false;
  }
}

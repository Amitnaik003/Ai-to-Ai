/**
 * Finds the active prompt input or rich-text editor on the page.
 * Supports Shadow DOM piercing for Web Components (Gemini) and nested frames.
 */
export function findActivePromptInput(): HTMLElement | null {
  function searchRoot(root: Document | ShadowRoot): HTMLElement | null {
    const selectors = [
      // ChatGPT (Lexical, ProseMirror, Textarea, and Canvas/New UI)
      "#prompt-textarea",
      "div#prompt-textarea[contenteditable='true']",
      "div#prompt-textarea",
      "div[data-testid='prompt-textarea']",
      "textarea[data-testid='prompt-textarea']",
      "textarea#prompt-textarea",
      "div[contenteditable='true'][id='prompt-textarea']",
      "div[contenteditable='true'][data-placeholder]",
      "div[role='textbox'][contenteditable='true']",

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
      "form textarea",
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
      // Target paragraph or child editable node if present (standard in Lexical/ChatGPT)
      const innerP = target.querySelector<HTMLElement>("p");
      const editTarget = innerP || target;

      // Position caret at end of current content
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editTarget);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);

      let injected = false;

      // 1A: Primary method for Lexical & ProseMirror - Synthetic ClipboardEvent paste
      // Lexical's PASTE_COMMAND processes multi-line text, removes placeholder, and syncs EditorState
      try {
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        const pasteEvent = new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        });
        target.dispatchEvent(pasteEvent);
        if (target.innerText && target.innerText.includes(text.slice(0, 10))) {
          injected = true;
        }
      } catch {
        injected = false;
      }

      // 1B: Synthetic BeforeInput with insertFromPaste / insertText
      if (!injected) {
        try {
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          const beforeInputEvent = new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertFromPaste",
            data: text,
            dataTransfer: dt
          });
          target.dispatchEvent(beforeInputEvent);
          if (target.innerText && target.innerText.includes(text.slice(0, 10))) {
            injected = true;
          }
        } catch {}
      }

      // 1C: document.execCommand('insertText')
      if (!injected) {
        try {
          const execOk = document.execCommand("insertText", false, text);
          if (execOk && target.innerText && target.innerText.includes(text.slice(0, 10))) {
            injected = true;
          }
        } catch {}
      }

      // 1D: Direct DOM fragment insertion fallback with line break preservation
      if (!injected && (!target.innerText || !target.innerText.includes(text.slice(0, 10)))) {
        const lines = text.split("\n");
        const fragment = document.createDocumentFragment();
        lines.forEach((line, idx) => {
          if (idx > 0) {
            fragment.appendChild(document.createElement("br"));
          }
          if (line) {
            fragment.appendChild(document.createTextNode(line));
          }
        });
        range.insertNode(fragment);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      // Notify modern framework state trackers (React, Lexical, Vue)
      target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      target.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: text }));

      // Special unlock for ChatGPT Send Button
      const chatgptSendButton = document.querySelector<HTMLButtonElement>(
        "button[data-testid='send-button'], button[aria-label*='Send prompt'], button[aria-label*='Send message']"
      );
      if (chatgptSendButton) {
        chatgptSendButton.removeAttribute("disabled");
        chatgptSendButton.disabled = false;
        chatgptSendButton.setAttribute("aria-disabled", "false");
      }

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

      // Also ensure send button on textarea forms is enabled
      const sendButton = target.form?.querySelector<HTMLButtonElement>(
        "button[data-testid='send-button'], button[type='submit']"
      );
      if (sendButton) {
        sendButton.removeAttribute("disabled");
        sendButton.disabled = false;
      }

      return true;
    }

    return false;
  } catch (err) {
    console.error("PromptWarp injection failed:", err);
    return false;
  }
}

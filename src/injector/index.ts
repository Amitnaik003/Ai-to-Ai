/**
 * Finds the active prompt input or rich-text editor on the page
 */
export function findActivePromptInput(): HTMLElement | null {
  // Ordered priority selectors for LLM chatboxes
  const selectors = [
    // ChatGPT
    "#prompt-textarea",
    "div[contenteditable='true'][data-placeholder]",
    "div#prompt-textarea[contenteditable='true']",
    
    // Claude
    "div.ProseMirror[contenteditable='true']",
    "div[contenteditable='true'][aria-label*='Prompt']",
    "div[contenteditable='true'][aria-label*='Claude']",

    // Gemini
    "rich-textarea div[contenteditable='true']",
    "div.ql-editor[contenteditable='true']",
    "div[contenteditable='true'][aria-label*='Gemini']",
    "div[contenteditable='true'][aria-label*='prompt']",

    // Gmail
    "div[role='textbox'][aria-label*='Message Body']",
    "div[role='textbox'][g_editable='true']",

    // Generic fallback
    "textarea[placeholder*='Message']",
    "textarea[placeholder*='Ask']",
    "textarea[placeholder*='prompt']",
    "textarea",
    "div[contenteditable='true']"
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel) as HTMLElement;
    if (el && el.offsetParent !== null) { // must be visible
      return el;
    }
  }

  // Active element fallback if user already focused the input
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
 * Robustly injects text into modern React/Vue/ProseMirror contenteditable or textarea inputs
 */
export function injectTextIntoElement(target: HTMLElement, text: string): boolean {
  try {
    target.focus();

    // Strategy 1: Modern Rich Text / ContentEditable (ProseMirror, Lexical, Quill)
    if (target.isContentEditable || target.getAttribute("contenteditable") === "true") {
      // Clear selection or select all if replacing, or place caret at end
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false); // caret at end
      selection?.removeAllRanges();
      selection?.addRange(range);

      // execCommand 'insertText' triggers framework internal transaction loops
      const inserted = document.execCommand("insertText", false, text);

      if (!inserted || !target.innerText.includes(text.slice(0, 15))) {
        // Fallback: Dispatch synthetic BeforeInput & Input events
        target.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: text
          })
        );
        target.innerText = (target.innerText ? target.innerText + "\n" : "") + text;
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }

      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    // Strategy 2: HTMLTextAreaElement / HTMLInputElement
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const currentVal = target.value;
      const newVal = currentVal ? `${currentVal}\n\n${text}` : text;

      // Bypass React state tracking via native prototype property descriptor
      const proto = Object.getPrototypeOf(target);
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

      if (nativeSetter) {
        nativeSetter.call(target, newVal);
      } else {
        target.value = newVal;
      }

      // Trigger synthetic events to notify React/Vue listeners
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
      target.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " " }));
      return true;
    }

    return false;
  } catch (err) {
    console.error("Capsule Hub injection failed:", err);
    return false;
  }
}

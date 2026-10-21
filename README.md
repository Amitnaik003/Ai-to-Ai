# Capsule Hub - Context Transfer Extension

A production-ready Chrome Extension (Manifest V3) inspired by **Capsule Hub by Tilantra**. Seamlessly capture, categorize, version, and transfer prompt contexts and conversation history between **ChatGPT**, **Claude**, **Gemini**, and **Gmail** with **zero hallucinations** and **minimal token consumption**.

---

## 🌟 Key Capabilities

1. **Manifest V3 Side Panel UI:**
   - Docked Side Panel built with **React 18**, **Tailwind CSS**, and **Lucide Icons**.
   - One-click context injection directly into active browser tabs.
   - Pinned favorites, search filter, category folders, and platform tags.
   - Version history and revision tracking across saved prompts.
   - Portable backup: Export and Import your entire capsule library in JSON.

2. **⚡ Token Saver & Structured Sequence Engine (`src/utils/tokenOptimizer.ts`):**
   - **Live Token Estimation:** Shows estimated token usage for GPT-4o, Claude 3.5 Sonnet, and Gemini 1.5.
   - **Chronological Sequence Assurance:** Formats conversations into ordered, tagged turns (`<turn index="1">`, `<turn index="2">`).
   - **Filler & Fluff Stripping:** Eliminates conversational preambles (*"Certainly! I'd be happy to help..."*) and outro pleasantries (*"Hope this helps!"*), saving 35%–55% prompt tokens.
   - **100% Code Protection:** Never modifies code blocks, indentation, backticks, or markdown tables.
   - **Standardized XML Schema:** Generates `<context_transfer>` with `<dialogue_sequence>` and `<handoff_instruction>` to eliminate receiving model confusion.

3. **Universal DOM Scraping Engine (`src/scrapers/`):**
   - **ChatGPT (`chatgpt.ts`):** Targets `[data-message-author-role]` turns and extracts clean markdown history.
   - **Claude (`claude.ts`):** Targets Claude conversation blocks, filtering UI artifacts.
   - **Gemini (`gemini.ts`):** Handles Gemini custom web-components (`<user-query>`, `<model-response>`).
   - **Gmail (`gmail.ts`):** Captures active email threads and compose bodies.

4. **Resilient Context Injection Engine (`src/injector/`):**
   - Bypasses the limitations of `textarea.value = ...` in modern React, Vue, Lexical, and ProseMirror apps.
   - Dispatches synthetic events, input events, and prototype descriptor updates to ensure the LLM input box recognizes the text.

5. **Local-First State Architecture (`src/storage/capsuleStore.ts`):**
   - Powered by `@plasmohq/storage` backed by `chrome.storage.local`.
   - Real-time cross-context reactivity between background service worker, content scripts, and side panel.

6. **In-Page Floating Widget (`src/contents/injector.tsx`):**
   - Unobtrusive floating trigger on supported platforms for rapid one-click captures and side panel toggles.

---

## 📥 How to Add & Load This Extension in Chrome

Follow these step-by-step instructions to load Capsule Hub into Google Chrome (or Edge, Brave, Opera, Arc):

### Step 1: Open the Extensions Page in Chrome
* Open Google Chrome.
* In the address bar, type `chrome://extensions` and press **Enter**.
* *(Alternatively, click the **three dots menu (⋮)** in the top right ➔ **Extensions** ➔ **Manage Extensions**).*

### Step 2: Enable "Developer Mode"
* Look in the **top-right corner** of the `chrome://extensions` page.
* Toggle the **Developer mode** switch to **ON**.

### Step 3: Click "Load Unpacked"
* In the top-left area, click the **Load unpacked** button.

### Step 4: Select the Extension Folder
Browse to your project directory and select:
* **For Active Development (Hot-Reloading):**
  ```text
  C:\AI to Ai\build\chrome-mv3-dev
  ```
* **For Production (Optimized & Minified):**
  ```text
  C:\AI to Ai\build\chrome-mv3-prod
  ```
* Click **Select Folder**.

### Step 5: Pin the Extension to the Chrome Toolbar
1. Click the **Puzzle Piece icon (🧩)** in the top right of your Chrome toolbar.
2. Find **Capsule Hub - Context Transfer**.
3. Click the **Pin icon (📌)** so it is always visible on your toolbar.

---

## 💡 How to Use Capsule Hub

### 1. Opening the Library
* Click the **Capsule Hub icon** on your Chrome toolbar to open the docked Side Panel.
* Or click the floating **Capsule button** in the bottom-right corner when browsing ChatGPT, Claude, Gemini, or Gmail.

### 2. Capturing Chats & Contexts
* **1-Click Full Chat Capture:** On any ChatGPT, Claude, Gemini, or Gmail tab, click the floating widget in the bottom-right corner and select **"Capture Current Chat"**.
* **Right-Click Selection Capture:** Highlight any text on any webpage, right-click, and select **"Save Selection to Capsule Hub"**.

### 3. Transferring / Injecting Context into Another LLM
1. Open your destination model in a tab (e.g., open **Claude** or **ChatGPT**).
2. Open the Capsule Hub Side Panel.
3. Find your desired capsule.
4. Click **"Inject"**.
5. The prompt context is automatically transferred directly into the active prompt textarea with zero manual copy-pasting!

### 4. Saving Tokens with the Structured Sequencer
* When creating or editing prompts in the Side Panel, click **"⚡ Structure & Sequence"**.
* It automatically cleans pleasantries and orders turns into a structured XML format (`<context_transfer>`), saving 35%–55% of context window tokens.

---

## 🛠️ Development & Building

### Install Dependencies
```bash
npm install
```

### Start Development Server (Auto-Reloading)
```bash
npm run dev
```

### Build Production Release
```bash
npm run build
```

---

## 📁 Repository Structure

```text
├── .gitignore                 # Git ignore configuration
├── package.json               # Plasmo & Manifest V3 configuration
├── tsconfig.json              # TypeScript configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS configuration
├── assets/
│   └── icon.png               # Extension icon
└── src/
    ├── background.ts          # Background service worker (side panel & context menus)
    ├── sidepanel.tsx          # Main Side Panel React application
    ├── style.css              # Global styles & Tailwind directives
    ├── types/                 # TypeScript interfaces (Capsule, Folder, Messages)
    ├── storage/               # Chrome local storage manager with versioning
    ├── scrapers/              # DOM extraction for ChatGPT, Claude, Gemini, Gmail
    ├── injector/              # Synthetic event input injection engine
    ├── contents/
    │   └── injector.tsx       # In-page floating widget & content script
    ├── utils/
    │   ├── tokenOptimizer.ts  # Token estimation, XML sequence builder, filler cleaner
    │   └── activeTab.ts       # Cross-tab dispatching utilities
    └── components/            # React UI components (Editor, Card, Header, Search)
```

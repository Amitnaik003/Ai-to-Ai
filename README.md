# Capsule Hub - Context Transfer Extension

A production-ready Chrome Extension (Manifest V3) inspired by **Capsule Hub by Tilantra**. Seamlessly capture, categorize, version, and transfer prompt contexts and conversation history between **ChatGPT**, **Claude**, **Gemini**, and **Gmail**.

---

## 🌟 Key Capabilities

1. **Manifest V3 Side Panel UI:**
   - Docked Side Panel built with **React**, **Tailwind CSS**, and **Lucide Icons**.
   - One-click context injection directly into active browser tabs.
   - Pinned favorites, search filter, category folders, and platform tags.
   - Version history and diff tracking across saved prompts.
   - Portable backup: Export and Import your entire capsule library in JSON.

2. **Universal DOM Scraping Engine (`src/scrapers/`):**
   - **ChatGPT (`chatgpt.ts`):** Targets `[data-message-author-role]` turns and extracts markdown prompt/response history.
   - **Claude (`claude.ts`):** Targets Claude conversation blocks, filtering UI artifacts.
   - **Gemini (`gemini.ts`):** Handles Gemini custom web-components (`<user-query>`, `<model-response>`).
   - **Gmail (`gmail.ts`):** Captures active email threads and compose bodies.

3. **Resilient Context Injection Engine (`src/injector/`):**
   - Bypasses the limitation of `textarea.value = ...` in modern frameworks.
   - Directly triggers ProseMirror, Lexical, and React synthetic event pipelines via `document.execCommand('insertText')` and native prototype descriptor setters.

4. **Local-First State Architecture (`src/storage/capsuleStore.ts`):**
   - Powered by `@plasmohq/storage` backed by `chrome.storage.local`.
   - Real-time cross-context reactivity between background, content scripts, and the side panel.

5. **In-Page Floating Widget (`contents/injector.tsx`):**
   - Unobtrusive floating trigger on supported platforms for rapid one-click captures and side panel toggles.

---

## 📁 Project Structure

```text
├── package.json               # Plasmo & Manifest V3 configuration
├── tsconfig.json              # TypeScript path aliases & JSX setup
├── tailwind.config.js         # Tailwind CSS styling configuration
├── postcss.config.js          # PostCSS configuration
├── style.css                  # Global Tailwind directives & custom scrollbars
├── background.ts              # Background service worker (side panel & context menus)
├── sidepanel.tsx              # Main Side Panel React application
├── contents/
│   └── injector.tsx           # Universal content script & floating overlay widget
└── src/
    ├── types/
    │   └── index.ts           # Capsule, Folder, and messaging type definitions
    ├── storage/
    │   └── capsuleStore.ts    # Reactive storage layer with versioning & export/import
    ├── utils/
    │   └── activeTab.ts       # Cross-tab message dispatching helpers
    ├── scrapers/
    │   ├── index.ts           # Platform router
    │   ├── chatgpt.ts         # ChatGPT DOM scraper
    │   ├── claude.ts          # Claude DOM scraper
    │   ├── gemini.ts          # Gemini DOM scraper
    │   └── gmail.ts           # Gmail thread scraper
    ├── injector/
    │   └── index.ts           # ProseMirror / Lexical / Textarea input injection
    └── components/
        ├── Header.tsx         # Side panel header & action bar
        ├── SearchBar.tsx      # Platform pills, folder select, search input
        ├── CapsuleCard.tsx    # Interactive capsule card with 1-click injection
        ├── CapsuleEditorModal.tsx # Create & edit modal
        └── ImportExportModal.tsx  # JSON backup & restore modal
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 2. Run in Development Mode
```bash
npm run dev
# or
pnpm dev
```
Plasmo will compile the extension and generate a live-reloading build in the `build/chrome-mv3-dev` directory.

### 3. Load into Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `build/chrome-mv3-dev` folder inside this project directory.
5. Pin the **Capsule Hub** icon in your Chrome toolbar.

### 4. How to Use
- **Open the Side Panel:** Click the Capsule Hub extension icon, or click the floating widget button on any supported site.
- **Save a Context:** Highlight any text and right-click -> *"Save Selection to Capsule Hub"*, or click *"Capture Current Chat"*.
- **Transfer Context:** Open ChatGPT, Claude, or Gemini in your browser, find the capsule in your Side Panel, and click **"Inject"**. The context will automatically populate into the active prompt input!

import { useState, useEffect, useCallback } from "react";
import { Storage } from "@plasmohq/storage";
import type { Capsule, Folder, CapsuleVersion } from "../types";

const storage = new Storage({ area: "local" });

const CAPSULES_KEY = "capsule_hub_items";
const FOLDERS_KEY = "capsule_hub_folders";

const INITIAL_FOLDERS: Folder[] = [
  { id: "f-prompts", name: "System Prompts", color: "#6366f1", createdAt: new Date().toISOString() },
  { id: "f-research", name: "Deep Research", color: "#10b981", createdAt: new Date().toISOString() },
  { id: "f-code", name: "Code Contexts", color: "#f59e0b", createdAt: new Date().toISOString() }
];

// Universal Storage helper for Chrome Storage or fallback
async function safeGet<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const val = await storage.get<T>(key);
    if (val !== undefined && val !== null) return val;
  } catch {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {}
      }
    }
  }
  return defaultValue;
}

async function safeSet<T>(key: string, value: T): Promise<void> {
  try {
    await storage.set(key, value);
  } catch {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }
}

export const CapsuleStore = {
  /**
   * Retrieves capsules from local storage.
   * Filters out any leftover legacy demo seeds (seed-1, seed-2, seed-3)
   * and never forces default chats into an empty library.
   */
  async getCapsules(): Promise<Capsule[]> {
    const items = await safeGet<Capsule[]>(CAPSULES_KEY, []);
    
    // Automatically purge legacy demo seeds if present
    const cleaned = items.filter((c) => !c.id || !c.id.startsWith("seed-"));
    if (cleaned.length !== items.length) {
      await safeSet(CAPSULES_KEY, cleaned);
      return cleaned;
    }
    
    return items;
  },

  async saveCapsule(capsule: Capsule): Promise<Capsule> {
    const items = await this.getCapsules();
    const existingIndex = items.findIndex((c) => c.id === capsule.id);

    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      const previousVersion: CapsuleVersion = {
        version: existing.version,
        updatedAt: existing.updatedAt,
        title: existing.title,
        content: existing.content,
        summary: existing.summary
      };

      const updatedCapsule: Capsule = {
        ...capsule,
        version: existing.version + 1,
        updatedAt: new Date().toISOString(),
        history: [previousVersion, ...(existing.history || [])]
      };

      items[existingIndex] = updatedCapsule;
      await safeSet(CAPSULES_KEY, items);
      return updatedCapsule;
    } else {
      const newCapsule: Capsule = {
        ...capsule,
        id: capsule.id || `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: []
      };

      const updated = [newCapsule, ...items];
      await safeSet(CAPSULES_KEY, updated);
      return newCapsule;
    }
  },

  async deleteCapsule(id: string): Promise<void> {
    const items = await this.getCapsules();
    const filtered = items.filter((c) => c.id !== id);
    await safeSet(CAPSULES_KEY, filtered);
  },

  /**
   * Wipes all saved capsules (for user library reset)
   */
  async clearAll(): Promise<void> {
    await safeSet(CAPSULES_KEY, []);
  },

  /**
   * Optional: Loads a single starter prompt only if the user explicitly requests examples.
   */
  async loadSample(): Promise<void> {
    const sample: Capsule = {
      id: `cap-${Date.now()}`,
      title: "Senior Fullstack Architect Prompt",
      summary: "Instructions setting up strict TypeScript, error boundaries, and defensive architecture.",
      content: `You are an elite Staff Software Architect. When generating code, follow these principles:
- Production-ready TypeScript with strict type-safety (no 'any').
- Clean architecture with clear separation of business logic and UI.
- Explain trade-offs before proposing radical architecture rewrites.
- Always include error boundaries and defensive handling for edge cases.`,
      platform: "chatgpt",
      tags: ["system-prompt", "architecture"],
      folderId: "f-prompts",
      isPinned: false,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.saveCapsule(sample);
  },

  async togglePin(id: string): Promise<void> {
    const items = await this.getCapsules();
    const updated = items.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c));
    await safeSet(CAPSULES_KEY, updated);
  },

  async getFolders(): Promise<Folder[]> {
    const folders = await safeGet<Folder[]>(FOLDERS_KEY, []);
    if (folders.length === 0) {
      await safeSet(FOLDERS_KEY, INITIAL_FOLDERS);
      return INITIAL_FOLDERS;
    }
    return folders;
  },

  async saveFolder(folder: Folder): Promise<Folder> {
    const folders = await this.getFolders();
    const index = folders.findIndex((f) => f.id === folder.id);
    let updated: Folder[];

    if (index >= 0) {
      updated = [...folders];
      updated[index] = folder;
    } else {
      const newFolder: Folder = {
        ...folder,
        id: folder.id || `f-${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      updated = [...folders, newFolder];
    }
    await safeSet(FOLDERS_KEY, updated);
    return folder;
  },

  async deleteFolder(folderId: string): Promise<void> {
    const folders = await this.getFolders();
    const updated = folders.filter((f) => f.id !== folderId);
    await safeSet(FOLDERS_KEY, updated);

    // Unassign folder from capsules
    const capsules = await this.getCapsules();
    const updatedCapsules = capsules.map((c) => (c.folderId === folderId ? { ...c, folderId: undefined } : c));
    await safeSet(CAPSULES_KEY, updatedCapsules);
  },

  async exportJSON(): Promise<string> {
    const capsules = await this.getCapsules();
    const folders = await this.getFolders();
    return JSON.stringify({ version: "1.0", exportedAt: new Date().toISOString(), capsules, folders }, null, 2);
  },

  async importJSON(jsonString: string): Promise<{ importedCount: number }> {
    const data = JSON.parse(jsonString);
    if (!data.capsules || !Array.isArray(data.capsules)) {
      throw new Error("Invalid Capsule Hub JSON format.");
    }
    const current = await this.getCapsules();
    const existingIds = new Set(current.map((c) => c.id));

    const newItems = data.capsules.filter((c: Capsule) => !existingIds.has(c.id));
    const merged = [...newItems, ...current];
    await safeSet(CAPSULES_KEY, merged);

    if (data.folders && Array.isArray(data.folders)) {
      const currentFolders = await this.getFolders();
      const folderIds = new Set(currentFolders.map((f) => f.id));
      const newFolders = data.folders.filter((f: Folder) => !folderIds.has(f.id));
      await safeSet(FOLDERS_KEY, [...currentFolders, ...newFolders]);
    }

    return { importedCount: newItems.length };
  }
};

/**
 * React Hook for seamless, reactive access to capsules and folders
 */
export function useCapsuleStore() {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [caps, flds] = await Promise.all([
        CapsuleStore.getCapsules(),
        CapsuleStore.getFolders()
      ]);
      setCapsules(caps);
      setFolders(flds);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Listen for storage changes across popup, background, and sidepanel
    const unwatchCapsules = storage.watch({
      [CAPSULES_KEY]: (change) => {
        if (change.newValue !== undefined) {
          const cleaned = Array.isArray(change.newValue)
            ? change.newValue.filter((c: Capsule) => !c.id?.startsWith("seed-"))
            : [];
          setCapsules(cleaned);
        }
      },
      [FOLDERS_KEY]: (change) => {
        if (change.newValue) {
          setFolders(change.newValue);
        }
      }
    });

    return () => {
      unwatchCapsules();
    };
  }, [refresh]);

  return {
    capsules,
    folders,
    loading,
    refresh,
    saveCapsule: async (cap: Capsule) => {
      const saved = await CapsuleStore.saveCapsule(cap);
      await refresh();
      return saved;
    },
    deleteCapsule: async (id: string) => {
      await CapsuleStore.deleteCapsule(id);
      await refresh();
    },
    clearAll: async () => {
      await CapsuleStore.clearAll();
      await refresh();
    },
    loadSample: async () => {
      await CapsuleStore.loadSample();
      await refresh();
    },
    togglePin: async (id: string) => {
      await CapsuleStore.togglePin(id);
      await refresh();
    },
    saveFolder: async (folder: Folder) => {
      const saved = await CapsuleStore.saveFolder(folder);
      await refresh();
      return saved;
    },
    deleteFolder: async (folderId: string) => {
      await CapsuleStore.deleteFolder(folderId);
      await refresh();
    },
    exportJSON: CapsuleStore.exportJSON,
    importJSON: async (json: string) => {
      const result = await CapsuleStore.importJSON(json);
      await refresh();
      return result;
    }
  };
}

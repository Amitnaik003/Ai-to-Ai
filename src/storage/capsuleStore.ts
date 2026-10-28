import { useState, useEffect, useCallback } from "react";
import { Storage } from "@plasmohq/storage";
import type { Capsule } from "../types";

const storage = new Storage({ area: "local" });
const CAPSULES_KEY = "capsule_hub_items";

// Universal Storage helper for Chrome Storage with fallback
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
  async getCapsules(): Promise<Capsule[]> {
    const items = await safeGet<Capsule[]>(CAPSULES_KEY, []);
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
      const updatedCapsule: Capsule = {
        ...capsule,
        updatedAt: new Date().toISOString()
      };
      items[existingIndex] = updatedCapsule;
      await safeSet(CAPSULES_KEY, items);
      return updatedCapsule;
    } else {
      const newCapsule: Capsule = {
        ...capsule,
        id: capsule.id || `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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

  async clearAll(): Promise<void> {
    await safeSet(CAPSULES_KEY, []);
  },

  async togglePin(id: string): Promise<void> {
    const items = await this.getCapsules();
    const updated = items.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c));
    await safeSet(CAPSULES_KEY, updated);
  },

  async exportJSON(): Promise<string> {
    const capsules = await this.getCapsules();
    return JSON.stringify({ version: "1.0", exportedAt: new Date().toISOString(), capsules }, null, 2);
  },

  async importJSON(jsonString: string): Promise<{ importedCount: number }> {
    let data: any;
    try {
      data = JSON.parse(jsonString);
    } catch {
      throw new Error("Invalid JSON format. Please verify your backup file.");
    }

    if (!data || !Array.isArray(data.capsules)) {
      throw new Error("Invalid PromptWarp JSON format. Missing capsules array.");
    }

    const current = await this.getCapsules();
    const existingIds = new Set(current.map((c) => c.id));

    const sanitizedNewItems: Capsule[] = [];
    for (const raw of data.capsules) {
      if (!raw || typeof raw !== "object") continue;
      const id = typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (existingIds.has(id)) continue;

      const safeCapsule: Capsule = {
        id,
        title: typeof raw.title === "string" ? raw.title.slice(0, 500) : "Imported Context",
        summary: typeof raw.summary === "string" ? raw.summary.slice(0, 1000) : "",
        content: typeof raw.content === "string" ? raw.content : "",
        messages: Array.isArray(raw.messages)
          ? raw.messages.filter((m: any) => m && typeof m.text === "string" && (m.role === "user" || m.role === "assistant" || m.role === "system"))
          : undefined,
        platform: typeof raw.platform === "string" ? (raw.platform as any) : "manual",
        sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : undefined,
        tags: Array.isArray(raw.tags)
          ? raw.tags.filter((t: any) => typeof t === "string").map((t: string) => t.slice(0, 50))
          : [],
        isPinned: Boolean(raw.isPinned),
        createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
      };

      sanitizedNewItems.push(safeCapsule);
      existingIds.add(id);
    }

    const merged = [...sanitizedNewItems, ...current];
    await safeSet(CAPSULES_KEY, merged);

    return { importedCount: sanitizedNewItems.length };
  }
};

/**
 * React Hook for seamless, reactive access to capsules
 */
export function useCapsuleStore() {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const caps = await CapsuleStore.getCapsules();
      setCapsules(caps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const watchMap = {
      [CAPSULES_KEY]: (change: any) => {
        if (change.newValue !== undefined) {
          const cleaned = Array.isArray(change.newValue)
            ? change.newValue.filter((c: Capsule) => !c.id?.startsWith("seed-"))
            : [];
          setCapsules(cleaned);
        }
      }
    };

    storage.watch(watchMap);

    return () => {
      storage.unwatch(watchMap);
    };
  }, [refresh]);

  return {
    capsules,
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
    togglePin: async (id: string) => {
      await CapsuleStore.togglePin(id);
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

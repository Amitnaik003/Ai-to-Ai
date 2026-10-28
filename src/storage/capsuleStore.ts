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
    const data = JSON.parse(jsonString);
    if (!data.capsules || !Array.isArray(data.capsules)) {
      throw new Error("Invalid PromptWarp JSON format.");
    }
    const current = await this.getCapsules();
    const existingIds = new Set(current.map((c) => c.id));

    const newItems = data.capsules.filter((c: Capsule) => !existingIds.has(c.id));
    const merged = [...newItems, ...current];
    await safeSet(CAPSULES_KEY, merged);

    return { importedCount: newItems.length };
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

    const unwatchCapsules = storage.watch({
      [CAPSULES_KEY]: (change) => {
        if (change.newValue !== undefined) {
          const cleaned = Array.isArray(change.newValue)
            ? change.newValue.filter((c: Capsule) => !c.id?.startsWith("seed-"))
            : [];
          setCapsules(cleaned);
        }
      }
    });

    return () => {
      unwatchCapsules();
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

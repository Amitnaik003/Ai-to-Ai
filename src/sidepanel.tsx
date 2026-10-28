import React, { useState, useMemo, useEffect } from "react";
import "./style.css";
import { useCapsuleStore } from "./storage/capsuleStore";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { CapsuleCard } from "./components/CapsuleCard";
import { CapsuleEditorModal } from "./components/CapsuleEditorModal";
import { ImportExportModal } from "./components/ImportExportModal";
import { triggerActiveTabCapture } from "./utils/activeTab";
import { buildStructuredContext, getConversationStats } from "./utils/contextFormatter";
import { setSidepanelFavicon } from "./utils/favicon";
import type { Capsule, CapsuleFilter } from "./types";
import { Sparkles, Inbox, Plus, AlertCircle, CheckCircle2, Info } from "lucide-react";

interface ToastState {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function SidePanel() {
  const {
    capsules,
    loading,
    saveCapsule,
    deleteCapsule,
    clearAll,
    togglePin,
    exportJSON,
    importJSON
  } = useCapsuleStore();

  const [filter, setFilter] = useState<CapsuleFilter>({
    search: "",
    platform: "all",
    pinnedOnly: false
  });

  const [editingCapsule, setEditingCapsule] = useState<Capsule | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 3200);
  };

  const handleFilterChange = (updated: Partial<CapsuleFilter>) => {
    setFilter((prev) => ({ ...prev, ...updated }));
  };

  // Total conversation turns across all chats in the library
  const totalMessages = useMemo(() => {
    return capsules.reduce(
      (sum, c) => sum + getConversationStats(c.messages || c.content).totalMessages,
      0
    );
  }, [capsules]);

  // Set favicon for the extension window/tab
  useEffect(() => {
    setSidepanelFavicon();
  }, []);

  // Keyboard shortcuts (Ctrl+N for new, Escape to dismiss)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setEditingCapsule(null);
        setIsEditorOpen(true);
      }
      if (e.key === "Escape") {
        setIsEditorOpen(false);
        setIsBackupModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCapsules = useMemo(() => {
    return capsules
      .filter((cap) => {
        // Platform filter
        if (filter.platform !== "all" && cap.platform !== filter.platform) {
          return false;
        }

        // Pinned only
        if (filter.pinnedOnly && !cap.isPinned) {
          return false;
        }

        // Search text matching title, tags, summary, or content
        if (filter.search.trim()) {
          const q = filter.search.toLowerCase();
          const matchTitle = cap.title.toLowerCase().includes(q);
          const matchSummary = cap.summary?.toLowerCase().includes(q);
          const matchContent = cap.content?.toLowerCase().includes(q);
          const matchTags = cap.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchSummary && !matchContent && !matchTags) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Pinned capsules always float to top
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then sort by most recently updated
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [capsules, filter]);

  const handleCaptureCurrentTab = async () => {
    setIsCapturing(true);
    showToast("Extracting context from active tab...", "info");

    try {
      const result = await triggerActiveTabCapture();
      setIsCapturing(false);

      if (result.success && result.capsule) {
        const rawContent = result.capsule.content || "";
        const structured = buildStructuredContext(result.capsule.messages || rawContent, {
          formatMode: "xml",
          sourcePlatform: (result.capsule.platform || "other").toUpperCase(),
          title: result.capsule.title || "Captured Context",
          summary: result.capsule.summary || "Conversation capture",
          includeHandoff: true
        });
        const content = structured.optimized || rawContent;

        const newCap: Capsule = {
          id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: result.capsule.title || "Captured Context",
          summary: result.capsule.summary || "Conversation capture",
          content,
          messages: result.capsule.messages,
          platform: result.capsule.platform || "other",
          sourceUrl: result.capsule.sourceUrl,
          tags: result.capsule.tags || ["auto-capture"],
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const saved = await saveCapsule(newCap);
        showToast(`Captured: "${saved.title.slice(0, 24)}"`, "success");
      } else {
        showToast(result.error || "Unable to extract chat context", "error");
      }
    } catch (err: any) {
      setIsCapturing(false);
      showToast(err?.message || "Capture failed", "error");
    }
  };

  const handleOpenNew = () => {
    setEditingCapsule(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (cap: Capsule) => {
    setEditingCapsule(cap);
    setIsEditorOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-mesh text-slate-800 antialiased overflow-hidden select-none font-sans">
      {/* Header */}
      <Header
        onNewCapsule={handleOpenNew}
        onOpenImportExport={() => setIsBackupModalOpen(true)}
        onCaptureCurrentTab={handleCaptureCurrentTab}
        isCapturing={isCapturing}
        totalCapsules={capsules.length}
        totalMessages={totalMessages}
      />

      {/* Search and Filters */}
      <SearchBar
        filter={filter}
        onFilterChange={handleFilterChange}
      />

      {/* Main Context Library Feed */}
      <main className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 animate-spin text-indigo-500" />
            </div>
            <p className="text-xs font-medium">Loading contexts…</p>
          </div>
        ) : filteredCapsules.length > 0 ? (
          filteredCapsules.map((cap) => (
            <CapsuleCard
              key={cap.id}
              capsule={cap}
              onEdit={handleEdit}
              onDelete={deleteCapsule}
              onTogglePin={togglePin}
              onShowToast={showToast}
              onUpdateCapsule={saveCapsule}
            />
          ))
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3 text-indigo-500">
              <Inbox className="w-7 h-7" />
            </div>

            <h3 className="text-sm font-bold text-slate-800">
              {filter.search || filter.platform !== "all" || filter.pinnedOnly
                ? "No contexts found"
                : "No saved contexts yet"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[220px] leading-relaxed">
              {filter.search || filter.platform !== "all" || filter.pinnedOnly
                ? "Try clearing your search query or platform filter."
                : "Capture conversations from ChatGPT, Claude, Gemini, Perplexity, DeepSeek or Gmail, or create a new prompt."}
            </p>

            <button
              onClick={handleOpenNew}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white shadow-md shadow-indigo-200 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>Create New Context</span>
            </button>
          </div>
        )}
      </main>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center pointer-events-none animate-toast">
          <div
            className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium shadow-lg border max-w-sm ${
              toast.type === "success"
                ? "bg-slate-900 text-white border-slate-800"
                : toast.type === "error"
                ? "bg-rose-900 text-white border-rose-800"
                : "bg-slate-900 text-white border-slate-800"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span className="truncate">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      <CapsuleEditorModal
        capsule={editingCapsule}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={async (cap) => {
          await saveCapsule(cap);
          showToast(editingCapsule ? "Context updated!" : "Context saved!", "success");
        }}
      />

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        capsules={capsules}
        onExport={exportJSON}
        onImport={importJSON}
        onClearAll={clearAll}
        onShowToast={showToast}
      />
    </div>
  );
}

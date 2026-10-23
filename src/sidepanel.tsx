import React, { useState, useMemo, useEffect } from "react";
import "./style.css";
import { useCapsuleStore } from "./storage/capsuleStore";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { CapsuleCard } from "./components/CapsuleCard";
import { CapsuleEditorModal } from "./components/CapsuleEditorModal";
import { ImportExportModal } from "./components/ImportExportModal";
import { triggerActiveTabCapture } from "./utils/activeTab";
import { estimateTokenCount, formatTokenCount, distillSmartCapsule } from "./utils/tokenOptimizer";
import type { Capsule, CapsuleFilter } from "./types";
import { Sparkles, Inbox, Plus, AlertCircle, CheckCircle2, Info, BookOpen, Zap } from "lucide-react";

interface ToastState {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function SidePanel() {
  const {
    capsules,
    folders,
    loading,
    saveCapsule,
    deleteCapsule,
    clearAll,
    loadSample,
    togglePin,
    exportJSON,
    importJSON,
    compressAllOversizedCapsules
  } = useCapsuleStore();

  const [filter, setFilter] = useState<CapsuleFilter>({
    search: "",
    platform: "all",
    folderId: "all",
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

  // Total tokens calculated across the entire library
  const totalTokens = useMemo(() => {
    return capsules.reduce((sum, c) => sum + estimateTokenCount(c.content), 0);
  }, [capsules]);

  // Count capsules that have raw oversized tokens (> 1,200 tokens)
  const oversizedCapsules = useMemo(() => {
    return capsules.filter((c) => estimateTokenCount(c.content) > 1200);
  }, [capsules]);

  const [isCompressing, setIsCompressing] = useState(false);

  const handleCompressLibrary = async () => {
    if (oversizedCapsules.length === 0) {
      showToast("Library is already optimized for ultra-low token utilization!", "info");
      return;
    }

    setIsCompressing(true);
    showToast(`Distilling ${oversizedCapsules.length} capsule(s) into ultra-low token format...`, "info");

    try {
      const res = await compressAllOversizedCapsules();
      setIsCompressing(false);
      if (res.compressedCount > 0) {
        showToast(
          `⚡ Saved ${res.savedTokens.toLocaleString()} tokens! Library reduced to ${formatTokenCount(res.newTotalTokens)}.`,
          "success"
        );
      } else {
        showToast("All capsules are already compressed.", "info");
      }
    } catch (err: any) {
      setIsCompressing(false);
      showToast(err?.message || "Compression failed", "error");
    }
  };

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

        // Folder filter
        if (filter.folderId !== "all" && cap.folderId !== filter.folderId) {
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
        const distilled = distillSmartCapsule(result.capsule.messages || rawContent, {
          sourcePlatform: (result.capsule.platform || "other").toUpperCase(),
          title: result.capsule.title || "Captured Context",
          summary: result.capsule.summary || "Conversation capture"
        });
        const content = distilled.optimized || rawContent;

        const newCap: Capsule = {
          id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: result.capsule.title || "Captured Context",
          summary: result.capsule.summary || "Conversation capture",
          content,
          messages: result.capsule.messages,
          platform: result.capsule.platform || "other",
          sourceUrl: result.capsule.sourceUrl,
          tags: result.capsule.tags || ["auto-capture", "low-token-capsule"],
          isPinned: false,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          history: []
        };
        const saved = await saveCapsule(newCap);
        const savingsBadge = distilled.savedTokens > 0 ? ` (Saved ${distilled.savedTokens} tokens!)` : "";
        showToast(`Captured: "${saved.title.slice(0, 20)}"${savingsBadge}`, "success");
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
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 antialiased overflow-hidden select-none font-sans">
      {/* Header */}
      <Header
        onNewCapsule={handleOpenNew}
        onOpenImportExport={() => setIsBackupModalOpen(true)}
        onCaptureCurrentTab={handleCaptureCurrentTab}
        onCompressLibrary={handleCompressLibrary}
        isCapturing={isCapturing}
        isCompressing={isCompressing}
        totalCapsules={capsules.length}
        totalTokens={totalTokens}
        oversizedCount={oversizedCapsules.length}
      />

      {/* Search and Filters */}
      <SearchBar
        filter={filter}
        folders={folders}
        onFilterChange={handleFilterChange}
      />

      {/* Low-Token Optimization Banner if oversized capsules exist */}
      {oversizedCapsules.length > 0 && (
        <div className="mx-3 mt-2 mb-1 p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-100/50 to-orange-50 border border-amber-300/80 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-3.5 h-3.5 fill-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-amber-950">
                {oversizedCapsules.length} oversized capsule{oversizedCapsules.length > 1 ? "s" : ""} ({formatTokenCount(totalTokens)})
              </p>
              <p className="text-[10px] text-amber-800">
                Compress to save ~90% tokens across AI platforms.
              </p>
            </div>
          </div>
          <button
            onClick={handleCompressLibrary}
            disabled={isCompressing}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs transition cursor-pointer"
          >
            <Zap className="w-3 h-3 fill-white" />
            <span>{isCompressing ? "Compressing..." : "⚡ Compress Library"}</span>
          </button>
        </div>
      )}

      {/* Main Capsule Library Feed */}
      <main className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
            <Sparkles className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs font-medium">Loading your capsules...</p>
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
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-3 border border-indigo-100 shadow-2xs">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">
              {filter.search || filter.platform !== "all" || filter.pinnedOnly
                ? "No matching capsules"
                : "Your context library is empty"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1.5 max-w-xs leading-relaxed">
              {filter.search || filter.platform !== "all" || filter.pinnedOnly
                ? "Try clearing your search query or platform filter to see more items."
                : "Save your favorite prompts, right-click on any page, or click Capture on ChatGPT, Claude, Gemini, or Gmail."}
            </p>

            <div className="flex flex-col items-center gap-2 mt-4">
              <button
                onClick={handleOpenNew}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Capsule</span>
              </button>

              {capsules.length === 0 && !filter.search && (
                <button
                  onClick={async () => {
                    await loadSample();
                    showToast("Sample architect prompt added!", "success");
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition pt-1 cursor-pointer"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Load 1 Example Prompt</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center pointer-events-none animate-in slide-in-from-bottom-2 fade-in duration-200">
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
        folders={folders}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={async (cap) => {
          await saveCapsule(cap);
          showToast(editingCapsule ? "Capsule updated!" : "Capsule created!", "success");
        }}
      />

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        capsules={capsules}
        folders={folders}
        onExport={exportJSON}
        onImport={importJSON}
        onClearAll={clearAll}
        onShowToast={showToast}
      />
    </div>
  );
}

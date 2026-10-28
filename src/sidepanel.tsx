import React, { useState, useMemo, useEffect } from "react";
import "./style.css";
import { useCapsuleStore } from "./storage/capsuleStore";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { CapsuleCard } from "./components/CapsuleCard";
import { CapsuleEditorModal } from "./components/CapsuleEditorModal";
import { ImportExportModal } from "./components/ImportExportModal";
import { CookPromptModal } from "./components/CookPromptModal";
import { triggerActiveTabCapture } from "./utils/activeTab";
import { buildStructuredContext, getConversationStats } from "./utils/contextFormatter";
import type { Capsule, CapsuleFilter } from "./types";
import { Sparkles, Inbox, Plus, AlertCircle, CheckCircle2, Info, BookOpen, Zap, Flame } from "lucide-react";

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
    toggleGolden,
    branchCapsule,
    rollbackVersion,
    exportJSON,
    importJSON,
    compressAllOversizedCapsules
  } = useCapsuleStore();

  const [filter, setFilter] = useState<CapsuleFilter>({
    search: "",
    platform: "all",
    folderId: "all",
    pinnedOnly: false,
    goldenOnly: false
  });

  const [editingCapsule, setEditingCapsule] = useState<Capsule | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Cook This Prompt Modal State (Tilantra feature)
  const [cookingCapsule, setCookingCapsule] = useState<Capsule | null>(null);
  const [isCookModalOpen, setIsCookModalOpen] = useState(false);

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
        setIsCookModalOpen(false);
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

        // Golden only (Tilantra Golden Prompts)
        if (filter.goldenOnly && !cap.isGolden) {
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
        // Then Golden Prompts float above standard capsules
        if (a.isGolden && !b.isGolden) return -1;
        if (!a.isGolden && b.isGolden) return 1;
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
          tags: result.capsule.tags || ["auto-capture", "structured-context"],
          isPinned: false,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          history: []
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

  // Branch a capsule into an independent fork
  const handleBranch = async (id: string) => {
    try {
      const branched = await branchCapsule(id);
      showToast(`Branched: "${branched.title.slice(0, 24)}" 🌿`, "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to branch capsule", "error");
    }
  };

  // Rollback capsule version
  const handleRollback = async (capsuleId: string, version: number) => {
    try {
      const restored = await rollbackVersion(capsuleId, version);
      if (restored) {
        showToast(`Rolled back to v${version} (now v${restored.version})! ⏱️`, "success");
      }
    } catch (err: any) {
      showToast(err?.message || "Rollback failed", "error");
    }
  };

  // Toggle Golden Prompt status
  const handleToggleGolden = async (id: string) => {
    await toggleGolden(id);
    const cap = capsules.find((c) => c.id === id);
    const isNowGolden = !cap?.isGolden;
    showToast(isNowGolden ? "Marked as Golden Prompt! 🏆" : "Unmarked Golden Prompt", "info");
  };

  // Open "Cook This Prompt" modal
  const handleOpenCook = (capsule: Capsule | null) => {
    setCookingCapsule(capsule);
    setIsCookModalOpen(true);
  };

  // Save Cooked Prompt as a new Golden Capsule
  const handleSaveCookedGolden = async (title: string, content: string) => {
    const newCap: Capsule = {
      id: `cap-golden-${Date.now()}`,
      title,
      summary: "Cooked Golden Prompt with frontier LLM benchmarks",
      content,
      platform: cookingCapsule?.platform || "manual",
      tags: ["golden-prompt", "cooked", "benchmark"],
      isPinned: false,
      isGolden: true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveCapsule(newCap);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-mesh text-slate-800 antialiased overflow-hidden select-none font-sans">
      {/* Header */}
      <Header
        onNewCapsule={handleOpenNew}
        onOpenImportExport={() => setIsBackupModalOpen(true)}
        onCaptureCurrentTab={handleCaptureCurrentTab}
        onOpenCookPrompt={() => handleOpenCook(null)}
        isCapturing={isCapturing}
        totalCapsules={capsules.length}
        totalMessages={totalMessages}
      />

      {/* Search and Filters */}
      <SearchBar
        filter={filter}
        folders={folders}
        onFilterChange={handleFilterChange}
      />

      {/* Main Capsule Library Feed */}
      <main className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 animate-spin text-indigo-500" />
            </div>
            <p className="text-xs font-medium">Loading your capsules…</p>
          </div>
        ) : filteredCapsules.length > 0 ? (
          filteredCapsules.map((cap) => (
            <CapsuleCard
              key={cap.id}
              capsule={cap}
              onEdit={handleEdit}
              onDelete={deleteCapsule}
              onTogglePin={togglePin}
              onToggleGolden={handleToggleGolden}
              onBranch={handleBranch}
              onRollback={handleRollback}
              onCookPrompt={handleOpenCook}
              onShowToast={showToast}
              onUpdateCapsule={saveCapsule}
            />
          ))
        ) : (
          /* ── Premium empty state ─────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-14 px-5 text-center">
            {/* Layered icon */}
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center border border-indigo-200/60 shadow-lg shadow-indigo-100">
                <Inbox className="w-7 h-7 text-indigo-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-800">
              {filter.search || filter.platform !== "all" || filter.pinnedOnly || filter.goldenOnly
                ? "No capsules found"
                : "Start your context library"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1.5 max-w-[220px] leading-relaxed">
              {filter.search || filter.platform !== "all" || filter.pinnedOnly || filter.goldenOnly
                ? "Clear your filters or search to see all capsules."
                : "Capture chats from ChatGPT, Claude, Gemini, Perplexity, DeepSeek or Gmail — then drag or inject them anywhere."}
            </p>

            <div className="flex flex-col items-center gap-2 mt-5">
              <button
                onClick={handleOpenNew}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white shadow-md shadow-indigo-200 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                <span>Create New Capsule</span>
              </button>

              {capsules.length === 0 && !filter.search && (
                <button
                  onClick={async () => {
                    await loadSample();
                    showToast("Sample architect prompt added!", "success");
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-indigo-600 transition cursor-pointer pt-0.5"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Load example prompt</span>
                </button>
              )}
            </div>
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

      {/* "Cook This Prompt" Modal (Tilantra feature) */}
      <CookPromptModal
        isOpen={isCookModalOpen}
        onClose={() => setIsCookModalOpen(false)}
        initialText={cookingCapsule ? cookingCapsule.content : ""}
        capsuleTitle={cookingCapsule ? cookingCapsule.title : "Custom Prompt"}
        sourceCapsule={cookingCapsule}
        onApplyCookedText={(cookedText) => {
          if (cookingCapsule) {
            saveCapsule({
              ...cookingCapsule,
              content: cookedText,
              updatedAt: new Date().toISOString()
            });
          }
        }}
        onSaveAsGoldenCapsule={handleSaveCookedGolden}
        onShowToast={showToast}
      />

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

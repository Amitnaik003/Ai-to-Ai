import React, { useState, useMemo, useEffect, useRef } from "react";
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
import { executeDeepSearch } from "./utils/deepSearch";
import { scanSecurity } from "./utils/securityScanner";
import { downloadBatchAsMarkdown, downloadBatchAsJSON } from "./utils/fileExporter";
import type { Capsule, CapsuleFilter } from "./types";
import {
  Sparkles,
  Inbox,
  Plus,
  AlertCircle,
  CheckCircle2,
  Info,
  CheckSquare,
  Square,
  Trash2,
  Download,
  Pin,
  X,
  FileText
} from "lucide-react";

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
    pinnedOnly: false,
    turnType: "all"
  });

  const [editingCapsule, setEditingCapsule] = useState<Capsule | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Batch / Multi-Select Mode
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search input ref for instant '/' shortcut focus
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Total words across the library (Zero tokens!)
  const totalWords = useMemo(() => {
    return capsules.reduce(
      (sum, c) => sum + getConversationStats(c.messages || c.content).wordCount,
      0
    );
  }, [capsules]);

  // Total security alerts across all chats in the library
  const totalSecurityAlerts = useMemo(() => {
    return capsules.filter((c) => !scanSecurity(c.content).isSecure).length;
  }, [capsules]);

  // Set favicon for the extension window/tab
  useEffect(() => {
    setSidepanelFavicon();
  }, []);

  // Keyboard shortcuts (Ctrl+N for new, '/' for search, Escape to dismiss/cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInput =
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      // '/' to focus search bar (if not typing in input)
      if (e.key === "/" && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      // Ctrl+N or Cmd+N for new capsule
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setEditingCapsule(null);
        setIsEditorOpen(true);
      }

      // Escape to exit batch mode or close modals
      if (e.key === "Escape") {
        if (isEditorOpen) {
          setIsEditorOpen(false);
        } else if (isBackupModalOpen) {
          setIsBackupModalOpen(false);
        } else if (isBatchMode) {
          setIsBatchMode(false);
          setSelectedIds(new Set());
        } else if (filter.search) {
          handleFilterChange({ search: "" });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditorOpen, isBackupModalOpen, isBatchMode, filter.search]);

  // Filtered & Sorted Capsule Feed
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

        // Security alerts only filter
        if (filter.securityAlertsOnly && scanSecurity(cap.content).isSecure) {
          return false;
        }

        // Turn Type filter (Threads vs Prompts)
        if (filter.turnType && filter.turnType !== "all") {
          const isMulti = getConversationStats(cap.messages || cap.content).isMultiTurn;
          if (filter.turnType === "dialogues" && !isMulti) return false;
          if (filter.turnType === "prompts" && isMulti) return false;
        }

        // DeepSearch across title, summary, tags, message turns, and code blocks
        if (filter.search.trim()) {
          const deepRes = executeDeepSearch(cap, filter.search);
          if (!deepRes.hasMatch) {
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

  // Active Tab Chat Capture
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

  // Batch Selection Handlers
  const handleToggleBatchMode = () => {
    setIsBatchMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const handleToggleSelectCard = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCapsules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCapsules.map((c) => c.id)));
    }
  };

  const selectedCapsules = useMemo(() => {
    return capsules.filter((c) => selectedIds.has(c.id));
  }, [capsules, selectedIds]);

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirm = window.confirm(`Delete ${selectedIds.size} selected context(s)? This cannot be undone.`);
    if (!confirm) return;

    for (const id of Array.from(selectedIds)) {
      await deleteCapsule(id);
    }
    showToast(`Deleted ${selectedIds.size} context(s)`, "info");
    setSelectedIds(new Set());
    setIsBatchMode(false);
  };

  const handleBatchExportMarkdown = () => {
    if (selectedCapsules.length === 0) return;
    try {
      downloadBatchAsMarkdown(selectedCapsules);
      showToast(`Exported ${selectedCapsules.length} contexts as Markdown!`, "success");
    } catch (err: any) {
      showToast(err.message || "Export failed", "error");
    }
  };

  const handleBatchExportJSON = () => {
    if (selectedCapsules.length === 0) return;
    try {
      downloadBatchAsJSON(selectedCapsules);
      showToast(`Exported ${selectedCapsules.length} contexts as JSON!`, "success");
    } catch (err: any) {
      showToast(err.message || "Export failed", "error");
    }
  };

  const handleBatchTogglePin = async () => {
    if (selectedCapsules.length === 0) return;
    for (const c of selectedCapsules) {
      await togglePin(c.id);
    }
    showToast(`Updated pin status for ${selectedCapsules.length} contexts`, "success");
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
        totalSecurityAlerts={totalSecurityAlerts}
        totalWords={totalWords}
        isBatchMode={isBatchMode}
        onToggleBatchMode={handleToggleBatchMode}
        selectedCount={selectedIds.size}
      />

      {/* Search and Filters */}
      <SearchBar
        filter={filter}
        onFilterChange={handleFilterChange}
        searchInputRef={searchInputRef}
      />

      {/* Batch Mode Toolbar (visible when batch mode active) */}
      {isBatchMode && (
        <div className="bg-indigo-50/90 border-b border-indigo-200/80 px-3 py-2 flex items-center justify-between text-xs animate-in fade-in duration-100">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900 cursor-pointer"
            >
              {selectedIds.size === filteredCapsules.length && filteredCapsules.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-indigo-400" />
              )}
              <span>
                {selectedIds.size === filteredCapsules.length && filteredCapsules.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </span>
            </button>
            <span className="text-[11px] text-indigo-500 font-medium">
              ({selectedIds.size} selected)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleBatchExportMarkdown}
              disabled={selectedIds.size === 0}
              title="Download selected contexts as consolidated Markdown"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-indigo-100/60 text-indigo-700 border border-indigo-200 font-semibold text-[11px] shadow-2xs transition disabled:opacity-40 cursor-pointer"
            >
              <FileText className="w-3 h-3 text-indigo-600" />
              <span>.md</span>
            </button>

            <button
              onClick={handleBatchExportJSON}
              disabled={selectedIds.size === 0}
              title="Download selected contexts as JSON"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-indigo-100/60 text-indigo-700 border border-indigo-200 font-semibold text-[11px] shadow-2xs transition disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-3 h-3 text-indigo-600" />
              <span>.json</span>
            </button>

            <button
              onClick={handleBatchTogglePin}
              disabled={selectedIds.size === 0}
              title="Toggle pin status for selected"
              className="p-1 rounded bg-white hover:bg-amber-50 text-amber-600 border border-amber-200 shadow-2xs transition disabled:opacity-40 cursor-pointer"
            >
              <Pin className="w-3 h-3 fill-amber-500" />
            </button>

            <button
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0}
              title="Delete selected contexts"
              className="p-1 rounded bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs transition disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setIsBatchMode(false);
                setSelectedIds(new Set());
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close batch mode"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
              isBatchMode={isBatchMode}
              isSelected={selectedIds.has(cap.id)}
              onToggleSelect={handleToggleSelectCard}
            />
          ))
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3 text-indigo-500">
              <Inbox className="w-7 h-7" />
            </div>

            <h3 className="text-sm font-bold text-slate-800">
              {filter.search || filter.platform !== "all" || filter.pinnedOnly || filter.turnType !== "all"
                ? "No contexts found"
                : "No saved contexts yet"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[220px] leading-relaxed">
              {filter.search || filter.platform !== "all" || filter.pinnedOnly || filter.turnType !== "all"
                ? "Try clearing your search query or adjusting your filters."
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

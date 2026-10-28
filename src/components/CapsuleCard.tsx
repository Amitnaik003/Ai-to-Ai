import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Pin,
  Copy,
  Check,
  Send,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  History,
  Clock,
  Sparkles,
  MoreHorizontal,
  FileText,
  ListOrdered,
  Flame,
  Award,
  GitFork,
  RotateCcw,
  GripVertical,
  MessageSquare
} from "lucide-react";
import type { Capsule, PlatformType } from "../types";
import { injectCapsuleIntoActiveTab } from "../utils/activeTab";
import { buildStructuredContext, getConversationStats } from "../utils/contextFormatter";

interface CapsuleCardProps {
  capsule: Capsule;
  onEdit: (capsule: Capsule) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleGolden?: (id: string) => void;
  onBranch?: (id: string) => void;
  onRollback?: (capsuleId: string, version: number) => void;
  onCookPrompt?: (capsule: Capsule) => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  onUpdateCapsule?: (capsule: Capsule) => Promise<Capsule | void>;
}

const PLATFORM_META: Record<
  PlatformType,
  { label: string; badge: string; dot: string; stripe: string; tagClass: string }
> = {
  chatgpt: {
    label: "ChatGPT",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    dot: "bg-emerald-500",
    stripe: "platform-stripe-chatgpt",
    tagClass: "tag-chatgpt"
  },
  claude: {
    label: "Claude",
    badge: "bg-amber-50 text-amber-700 border-amber-200/70",
    dot: "bg-amber-500",
    stripe: "platform-stripe-claude",
    tagClass: "tag-claude"
  },
  gemini: {
    label: "Gemini",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
    dot: "bg-indigo-500",
    stripe: "platform-stripe-gemini",
    tagClass: "tag-gemini"
  },
  perplexity: {
    label: "Perplexity",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200/70",
    dot: "bg-cyan-600",
    stripe: "platform-stripe-perplexity",
    tagClass: "tag-perplexity"
  },
  deepseek: {
    label: "DeepSeek",
    badge: "bg-blue-50 text-blue-700 border-blue-200/70",
    dot: "bg-blue-600",
    stripe: "platform-stripe-deepseek",
    tagClass: "tag-deepseek"
  },
  gmail: {
    label: "Gmail",
    badge: "bg-rose-50 text-rose-700 border-rose-200/60",
    dot: "bg-rose-500",
    stripe: "platform-stripe-gmail",
    tagClass: "tag-gmail"
  },
  manual: {
    label: "Custom",
    badge: "bg-slate-50 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    stripe: "platform-stripe-manual",
    tagClass: "tag-default"
  },
  other: {
    label: "Web",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dot: "bg-cyan-500",
    stripe: "platform-stripe-other",
    tagClass: "tag-default"
  }
};

type TransferMode = "formatted" | "raw";

/* ─── Overflow Menu ────────────────────────────────────────────────────── */
const OverflowMenu: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
  onBranch?: () => void;
  onCook?: () => void;
  onHistory: () => void;
  hasHistory: boolean;
}> = ({ onEdit, onDelete, onBranch, onCook, onHistory, hasHistory }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        title="More options"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-44 animate-fade-in text-xs">
          {onCook && (
            <button
              onClick={() => { onCook(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-amber-700 hover:bg-amber-50 font-medium transition"
            >
              <Flame className="w-3.5 h-3.5 text-amber-600" />
              <span>Cook This Prompt</span>
            </button>
          )}

          {onBranch && (
            <button
              onClick={() => { onBranch(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-50 font-medium transition"
            >
              <GitFork className="w-3.5 h-3.5 text-indigo-600" />
              <span>Branch (Fork Context)</span>
            </button>
          )}

          {hasHistory && (
            <button
              onClick={() => { onHistory(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
            >
              <History className="w-3.5 h-3.5" />
              <span>Version History</span>
            </button>
          )}

          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Capsule</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-600 hover:bg-rose-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── Main Card ────────────────────────────────────────────────────────── */
export const CapsuleCard: React.FC<CapsuleCardProps> = ({
  capsule,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleGolden,
  onBranch,
  onRollback,
  onCookPrompt,
  onShowToast,
  onUpdateCapsule
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectSuccess, setInjectSuccess] = useState(false);
  const [transferMode, setTransferMode] = useState<TransferMode>("formatted");
  const [previewTab, setPreviewTab] = useState<TransferMode>("formatted");
  const [isDragging, setIsDragging] = useState(false);

  const meta = PLATFORM_META[capsule.platform] || PLATFORM_META.manual;

  // Clean structured context preserving all conversation turns
  const stats = useMemo(
    () => getConversationStats(capsule.messages || capsule.content),
    [capsule.messages, capsule.content]
  );

  const structuredSequence = useMemo(
    () =>
      buildStructuredContext(capsule.messages || capsule.content, {
        formatMode: "xml",
        sourcePlatform: capsule.platform.toUpperCase(),
        title: capsule.title,
        summary: capsule.summary,
        includeHandoff: true
      }),
    [capsule]
  );

  const activePayload = useMemo(() => {
    if (transferMode === "formatted") return structuredSequence.optimized;
    return capsule.content;
  }, [transferMode, structuredSequence, capsule.content]);

  const previewPayload = useMemo(() => {
    if (previewTab === "formatted") return structuredSequence.optimized;
    return capsule.content;
  }, [previewTab, structuredSequence, capsule.content]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activePayload);
      setCopied(true);
      onShowToast(
        transferMode === "formatted"
          ? "Structured context sequence copied!"
          : "Raw context copied!",
        "success"
      );
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast("Failed to copy to clipboard", "error");
    }
  };

  const handleInject = async () => {
    setIsInjecting(true);
    setInjectSuccess(false);
    const result = await injectCapsuleIntoActiveTab(activePayload);
    setIsInjecting(false);

    if (result.success) {
      setInjectSuccess(true);
      onShowToast(
        transferMode === "formatted"
          ? "Structured sequence injected into chat! 🚀"
          : "Raw context injected! 🚀",
        "success"
      );
      setTimeout(() => setInjectSuccess(false), 2500);
    } else {
      onShowToast(result.error || "Could not inject into page", "error");
    }
  };

  // ── Drag and Drop Support (Tilantra Feature) ────────────────────────
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData("text/plain", activePayload);
    const payloadStr = JSON.stringify({
      id: capsule.id,
      title: capsule.title,
      content: activePayload,
      platform: capsule.platform
    });
    e.dataTransfer.setData("application/x-ai-to-ai", payloadStr);
    e.dataTransfer.setData("application/x-capsule-hub", payloadStr);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group relative card-glass rounded-xl border transition-all duration-200 overflow-hidden
        ${meta.stripe}
        ${capsule.isGolden ? "golden-card-glow border-amber-300/80 bg-amber-50/15" : ""}
        ${
          capsule.isPinned && !capsule.isGolden
            ? "border-amber-200 shadow-md shadow-amber-100/60"
            : "border-slate-200/90 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/70"
        }
        ${isDragging ? "opacity-60 scale-[0.98] ring-2 ring-indigo-400" : ""}
        animate-card
      `}
    >
      {/* ── Top row: badges + controls ──────────────────────────────── */}
      <div className="flex items-start justify-between gap-1.5 px-3 pt-2.5 pb-0">
        {/* Left: Drag Handle + Platform badge + version + date */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Drag Handle Indicator */}
          <span
            title="Drag & drop this capsule directly into any AI chat input"
            className="text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>

          {/* Platform pill */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
            {meta.label}
          </span>

          {/* Conversation Messages Count in Entire Chat */}
          <span
            title={stats.detailedLabel}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50/90 text-indigo-700 border border-indigo-200/60"
          >
            <MessageSquare className="w-2.5 h-2.5 fill-indigo-600 text-indigo-600 shrink-0" />
            <span>{stats.label}</span>
          </span>

          {/* Golden Prompt Badge if active */}
          {capsule.isGolden && (
            <span
              title="Tilantra Golden Prompt Standard"
              className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md golden-badge border"
            >
              <Award className="w-2.5 h-2.5 fill-amber-500 text-amber-700" />
              Golden
            </span>
          )}

          {/* Version */}
          {capsule.version > 1 && (
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
              v{capsule.version}
            </span>
          )}

          {/* Date */}
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5 shrink-0" />
            {new Date(capsule.updatedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric"
            })}
          </span>
        </div>

        {/* Right: Golden star + Pin + overflow menu + expand */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Golden Prompt Toggle */}
          {onToggleGolden && (
            <button
              onClick={() => onToggleGolden(capsule.id)}
              title={capsule.isGolden ? "Remove Golden Prompt status" : "Mark as Golden Prompt"}
              className={`p-1 rounded-md transition cursor-pointer ${
                capsule.isGolden
                  ? "text-amber-500 bg-amber-100/70"
                  : "text-slate-300 hover:text-amber-500 hover:bg-amber-50"
              }`}
            >
              <Award className={`w-3.5 h-3.5 ${capsule.isGolden ? "fill-amber-500" : ""}`} />
            </button>
          )}

          {/* Pin Toggle */}
          <button
            onClick={() => onTogglePin(capsule.id)}
            title={capsule.isPinned ? "Unpin" : "Pin to top"}
            className={`p-1 rounded-md transition cursor-pointer ${
              capsule.isPinned
                ? "text-amber-500 bg-amber-50"
                : "text-slate-300 hover:text-amber-400 hover:bg-amber-50"
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${capsule.isPinned ? "fill-amber-500" : ""}`} />
          </button>

          {/* Overflow Menu with Branch & Cook */}
          <OverflowMenu
            onEdit={() => onEdit(capsule)}
            onDelete={() => onDelete(capsule.id)}
            onBranch={onBranch ? () => onBranch(capsule.id) : undefined}
            onCook={onCookPrompt ? () => onCookPrompt(capsule) : undefined}
            onHistory={() => {
              setIsExpanded(true);
              setShowHistory((v) => !v);
            }}
            hasHistory={!!(capsule.history && capsule.history.length > 0)}
          />

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded((v) => !v)}
            title={isExpanded ? "Collapse" : "Expand preview"}
            className="p-1 rounded-md text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ── Branch lineage pill if branched ─────────────────────────── */}
      {capsule.branchedFrom && (
        <div className="px-3 pt-1">
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
            <GitFork className="w-2.5 h-2.5" />
            <span>Forked from: {capsule.branchedFrom.title.slice(0, 30)} (v{capsule.branchedFrom.version})</span>
          </span>
        </div>
      )}

      {/* ── Title + Summary ─────────────────────────────────────────── */}
      <div className="px-3 pt-1.5 pb-1">
        <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors leading-snug line-clamp-1">
          {capsule.title}
        </h3>

        {capsule.summary && (
          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
            {capsule.summary}
          </p>
        )}

        {/* Tags */}
        {capsule.tags && capsule.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            {capsule.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${meta.tagClass}`}
              >
                #{tag}
              </span>
            ))}
            {capsule.tags.length > 5 && (
              <span className="text-[9px] text-slate-400 font-medium">
                +{capsule.tags.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Expanded Preview ────────────────────────────────────────── */}
      {isExpanded && (
        <div className="mx-3 mb-2 mt-1 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 animate-fade-in">
          {/* Preview tab strip */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200/70 bg-white/70">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg gap-px">
              <button
                onClick={() => setPreviewTab("formatted")}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                  previewTab === "formatted"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <ListOrdered className="w-3 h-3" />
                Formatted
              </button>
              <button
                onClick={() => setPreviewTab("raw")}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                  previewTab === "raw"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-3 h-3" />
                Raw Text
              </button>
            </div>

            <span className="text-[10px] text-slate-500 font-medium pr-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-indigo-500" />
              <span>{stats.totalMessages} conversation {stats.totalMessages === 1 ? "turn" : "turns"}</span>
              <span>·</span>
              <span className="font-mono text-slate-400">{capsule.content.length} chars</span>
            </span>
          </div>

          {/* Preview body */}
          <div className="p-2.5 text-[11px] font-mono leading-relaxed text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap select-text">
            {previewPayload}
          </div>

          {/* History pane with Version Rollback (Tilantra feature) */}
          {showHistory && capsule.history && capsule.history.length > 0 && (
            <div className="border-t border-slate-200/70 px-2.5 py-2 space-y-1.5 max-h-40 overflow-y-auto bg-white/70">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-slate-700">
                  Version History ({capsule.history.length} revisions)
                </p>
                <span className="text-[9px] text-slate-400">Click rollback to restore</span>
              </div>
              {capsule.history.map((rev) => (
                <div
                  key={rev.version}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-0.5">
                      <span className="text-indigo-600 font-bold">v{rev.version}</span>
                      <span>·</span>
                      <span>{new Date(rev.updatedAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 line-clamp-1 leading-snug">
                      {rev.summary || rev.content}
                    </p>
                  </div>

                  {onRollback && (
                    <button
                      onClick={() => onRollback(capsule.id, rev.version)}
                      title={`Restore version v${rev.version}`}
                      className="inline-flex items-center gap-0.5 px-1.5 py-1 text-[9px] font-semibold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded shrink-0 transition cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Rollback</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom action bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pb-2.5 pt-1.5 gap-2">
        {/* Left: Inject + Copy + Cook This Prompt */}
        <div className="flex items-center gap-1.5">
          {/* Inject — primary CTA */}
          <button
            onClick={handleInject}
            disabled={isInjecting}
            className={`btn-inject flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer ${
              injectSuccess ? "!bg-emerald-500 !bg-none" : isInjecting ? "opacity-70 cursor-wait" : ""
            }`}
            title="Inject context into active chat input"
          >
            {injectSuccess ? (
              <><Check className="w-3.5 h-3.5" /><span>Injected!</span></>
            ) : isInjecting ? (
              <><Sparkles className="w-3.5 h-3.5 animate-spin" /><span>Injecting…</span></>
            ) : (
              <><Send className="w-3.5 h-3.5" /><span>Inject</span></>
            )}
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
          >
            {copied
              ? <Check className="w-3.5 h-3.5 text-emerald-600" />
              : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Cook Prompt Button (Tilantra signature) */}
          {onCookPrompt && (
            <button
              onClick={() => onCookPrompt(capsule)}
              title="Cook This Prompt: enhance, benchmark and structure"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 transition cursor-pointer border border-amber-200"
            >
              <Flame className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Cook</span>
            </button>
          )}
        </div>

        {/* Right: Transfer mode selector: Formatted vs Raw */}
        <div className="flex items-center bg-slate-100 border border-slate-200/80 p-0.5 rounded-lg gap-px">
          <button
            onClick={() => setTransferMode("formatted")}
            title="Formatted Sequence: all turns in chronological order"
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
              transferMode === "formatted"
                ? "bg-white shadow-sm text-indigo-700"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            Formatted
          </button>
          <button
            onClick={() => setTransferMode("raw")}
            title="Raw: original untouched text"
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
              transferMode === "raw"
                ? "bg-white shadow-sm text-slate-800"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            Raw
          </button>
        </div>
      </div>
    </div>
  );
};

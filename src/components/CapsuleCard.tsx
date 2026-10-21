import React, { useState, useMemo } from "react";
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
  Zap,
  ListOrdered
} from "lucide-react";
import type { Capsule, PlatformType } from "../types";
import { injectCapsuleIntoActiveTab } from "../utils/activeTab";
import {
  estimateTokenCount,
  formatTokenCount,
  buildStructuredContext,
  optimizeContext
} from "../utils/tokenOptimizer";

interface CapsuleCardProps {
  capsule: Capsule;
  onEdit: (capsule: Capsule) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  onUpdateCapsule?: (capsule: Capsule) => Promise<Capsule | void>;
}

const PLATFORM_STYLES: Record<PlatformType, { label: string; badge: string; dot: string }> = {
  chatgpt: {
    label: "ChatGPT",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    dot: "bg-emerald-500"
  },
  claude: {
    label: "Claude",
    badge: "bg-amber-50 text-amber-700 border-amber-200/70",
    dot: "bg-amber-500"
  },
  gemini: {
    label: "Gemini",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
    dot: "bg-indigo-500"
  },
  gmail: {
    label: "Gmail",
    badge: "bg-rose-50 text-rose-700 border-rose-200/70",
    dot: "bg-rose-500"
  },
  manual: {
    label: "Custom",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
    dot: "bg-slate-400"
  },
  other: {
    label: "Web",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dot: "bg-cyan-500"
  }
};

export const CapsuleCard: React.FC<CapsuleCardProps> = ({
  capsule,
  onEdit,
  onDelete,
  onTogglePin,
  onShowToast,
  onUpdateCapsule
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectSuccess, setInjectSuccess] = useState(false);
  const [useOptimized, setUseOptimized] = useState(true);
  const [isStructuring, setIsStructuring] = useState(false);
  const [previewTab, setPreviewTab] = useState<"structured" | "raw">("structured");

  const style = PLATFORM_STYLES[capsule.platform] || PLATFORM_STYLES.manual;

  // Real-time structured context & token calculation
  const originalTokens = useMemo(() => estimateTokenCount(capsule.content), [capsule.content]);

  const structuredContext = useMemo(() => {
    return buildStructuredContext(capsule.messages || capsule.content, {
      formatMode: "xml",
      sourcePlatform: capsule.platform.toUpperCase(),
      title: capsule.title,
      summary: capsule.summary,
      includeHandoff: true
    });
  }, [capsule]);

  const hasSavings = structuredContext.savedTokens > 5;

  const handleCopy = async () => {
    try {
      const textToCopy = useOptimized ? structuredContext.optimized : capsule.content;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);

      if (useOptimized && structuredContext.savedTokens > 0) {
        onShowToast(
          `Copied structured context! Saved ${structuredContext.savedTokens} tokens (${structuredContext.savingsPercent}% reduction)`,
          "success"
        );
      } else {
        onShowToast("Copied context to clipboard!", "success");
      }

      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast("Failed to copy to clipboard", "error");
    }
  };

  const handleInject = async () => {
    setIsInjecting(true);
    setInjectSuccess(false);

    const textToInject = useOptimized ? structuredContext.optimized : capsule.content;
    const result = await injectCapsuleIntoActiveTab(textToInject);
    setIsInjecting(false);

    if (result.success) {
      setInjectSuccess(true);
      if (useOptimized && structuredContext.savedTokens > 0) {
        onShowToast(
          `Injected structured context! Saved ${structuredContext.savedTokens} tokens`,
          "success"
        );
      } else {
        onShowToast("Injected context into active chat input!", "success");
      }
      setTimeout(() => setInjectSuccess(false), 2500);
    } else {
      onShowToast(result.error || "Could not inject into page", "error");
    }
  };

  const handleStructureInPlace = async () => {
    if (!onUpdateCapsule) return;
    try {
      setIsStructuring(true);
      await onUpdateCapsule({
        ...capsule,
        content: structuredContext.optimized
      });
      onShowToast(
        `Formatted into structured sequence! Saved ${structuredContext.savedTokens} tokens (-${structuredContext.savingsPercent}%)`,
        "success"
      );
    } catch {
      onShowToast("Failed to save structured revision", "error");
    } finally {
      setIsStructuring(false);
    }
  };

  return (
    <div
      className={`group relative bg-white border rounded-xl p-3.5 transition-all shadow-xs hover:shadow-sm ${
        capsule.isPinned
          ? "border-amber-200 bg-amber-50/20 shadow-amber-50"
          : "border-slate-200/90 hover:border-slate-300"
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>

          {/* Token count badge */}
          <span
            title={`Estimated prompt tokens: ${originalTokens} tokens (~${capsule.content.length} characters)`}
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-700 bg-indigo-50/90 border border-indigo-200/70 px-1.5 py-0.5 rounded"
          >
            <Zap className="w-2.5 h-2.5 fill-indigo-600 text-indigo-600" />
            {formatTokenCount(originalTokens)}
          </span>

          {capsule.version > 1 && (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              v{capsule.version}
            </span>
          )}

          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(capsule.updatedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric"
            })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Structure & Sequence Action */}
          {hasSavings && onUpdateCapsule && (
            <button
              onClick={handleStructureInPlace}
              disabled={isStructuring}
              title={`Format into structured sequence & save ${structuredContext.savedTokens} tokens permanently`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer"
            >
              <ListOrdered className="w-2.5 h-2.5 text-indigo-600" />
              <span>⚡ Structure (-{structuredContext.savedTokens}t)</span>
            </button>
          )}

          <button
            onClick={() => onTogglePin(capsule.id)}
            title={capsule.isPinned ? "Unpin capsule" : "Pin to top"}
            className={`p-1 rounded transition cursor-pointer ${
              capsule.isPinned
                ? "text-amber-500 hover:text-amber-600 bg-amber-50"
                : "text-slate-300 hover:text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${capsule.isPinned ? "fill-amber-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">
        {capsule.title}
      </h3>

      {/* Summary */}
      {capsule.summary && (
        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
          {capsule.summary}
        </p>
      )}

      {/* Tags */}
      {capsule.tags && capsule.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mt-2">
          {capsule.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Expandable Full Context Preview */}
      {isExpanded && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            {/* View Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-[10px]">
              <button
                onClick={() => setPreviewTab("structured")}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  previewTab === "structured"
                    ? "bg-white text-indigo-700 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Structured Sequence
              </button>
              <button
                onClick={() => setPreviewTab("raw")}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  previewTab === "raw"
                    ? "bg-white text-indigo-700 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Raw Source
              </button>
            </div>

            <span className="text-[10px] text-slate-400 font-mono">
              {previewTab === "structured"
                ? `${formatTokenCount(structuredContext.optimizedTokens)} (saved ${structuredContext.savedTokens}t)`
                : `${formatTokenCount(originalTokens)} · ${capsule.content.length} chars`}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg text-slate-800 text-[11px] font-mono leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap select-text border border-slate-200/60">
            {previewTab === "structured" ? structuredContext.optimized : capsule.content}
          </div>

          {/* History Subview */}
          {showHistory && capsule.history && capsule.history.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-semibold text-slate-600 block mb-1">
                Version Revisions ({capsule.history.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {capsule.history.map((rev) => (
                  <div key={rev.version} className="p-1.5 bg-white border border-slate-200 rounded text-[10px]">
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>v{rev.version}</span>
                      <span>{new Date(rev.updatedAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 line-clamp-2 mt-0.5">{rev.summary || rev.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          {/* Main Action: Inject Context into Active Tab */}
          <button
            onClick={handleInject}
            disabled={isInjecting}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              injectSuccess
                ? "bg-emerald-600 text-white shadow-xs"
                : isInjecting
                ? "bg-indigo-400 text-white cursor-wait"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow"
            }`}
            title={
              useOptimized
                ? `Inject structured sequenced context into active LLM (saves ${structuredContext.savedTokens} tokens)`
                : "Inject raw text directly into active input"
            }
          >
            {injectSuccess ? (
              <>
                <Check className="w-3 h-3" />
                <span>Injected!</span>
              </>
            ) : isInjecting ? (
              <>
                <Sparkles className="w-3 h-3 animate-spin" />
                <span>Injecting...</span>
              </>
            ) : (
              <>
                <Send className="w-3 h-3" />
                <span>Inject</span>
              </>
            )}
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title={
              useOptimized
                ? `Copy structured sequence prompt (saves ${structuredContext.savedTokens} tokens)`
                : "Copy prompt context to clipboard"
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Mode Toggle Pill */}
          <button
            onClick={() => setUseOptimized(!useOptimized)}
            title={
              useOptimized
                ? "Structured Mode active: transfers clean chronological sequence with minimal tokens (Click to switch to raw)"
                : "Raw Mode active: transfers original text as-is (Click to enable Structured Sequence)"
            }
            className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-semibold transition cursor-pointer border ${
              useOptimized
                ? "bg-indigo-50/90 text-indigo-700 border-indigo-200"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}
          >
            <Zap className={`w-2.5 h-2.5 ${useOptimized ? "fill-indigo-600 text-indigo-600" : ""}`} />
            <span>{useOptimized ? "Structured" : "Raw"}</span>
          </button>
        </div>

        {/* Secondary Options */}
        <div className="flex items-center gap-0.5">
          {capsule.history && capsule.history.length > 0 && (
            <button
              onClick={() => {
                setIsExpanded(true);
                setShowHistory(!showHistory);
              }}
              title="Show version history"
              className={`p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer ${
                showHistory ? "text-indigo-600 bg-indigo-50" : ""
              }`}
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onEdit(capsule)}
            title="Edit capsule"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(capsule.id)}
            title="Delete capsule"
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse preview" : "Expand context preview"}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ml-0.5 cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

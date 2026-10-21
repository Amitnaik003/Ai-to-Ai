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
  ListOrdered,
  FileText
} from "lucide-react";
import type { Capsule, PlatformType } from "../types";
import { injectCapsuleIntoActiveTab } from "../utils/activeTab";
import {
  estimateTokenCount,
  formatTokenCount,
  buildStructuredContext,
  distillSmartCapsule,
  OptimizationResult
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

type TransferMode = "smart" | "clean" | "raw";

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
  const [transferMode, setTransferMode] = useState<TransferMode>("smart");
  const [isDistilling, setIsDistilling] = useState(false);
  const [previewTab, setPreviewTab] = useState<TransferMode>("smart");

  const style = PLATFORM_STYLES[capsule.platform] || PLATFORM_STYLES.manual;

  // 1. Raw tokens
  const rawTokens = useMemo(() => estimateTokenCount(capsule.content), [capsule.content]);

  // 2. Smart Capsule (Ultra-low tokens: 80%–95% savings)
  const smartCapsule = useMemo(() => {
    return distillSmartCapsule(capsule.messages || capsule.content, {
      sourcePlatform: capsule.platform.toUpperCase(),
      title: capsule.title,
      summary: capsule.summary
    });
  }, [capsule]);

  // 3. Clean full sequence
  const cleanSequence = useMemo(() => {
    return buildStructuredContext(capsule.messages || capsule.content, {
      formatMode: "xml",
      sourcePlatform: capsule.platform.toUpperCase(),
      title: capsule.title,
      summary: capsule.summary,
      includeHandoff: true
    });
  }, [capsule]);

  // Active payload based on user selection
  const activePayload = useMemo(() => {
    if (transferMode === "smart") return smartCapsule.optimized;
    if (transferMode === "clean") return cleanSequence.optimized;
    return capsule.content;
  }, [transferMode, smartCapsule, cleanSequence, capsule.content]);

  const activeTokens = useMemo(() => {
    if (transferMode === "smart") return smartCapsule.optimizedTokens;
    if (transferMode === "clean") return cleanSequence.optimizedTokens;
    return rawTokens;
  }, [transferMode, smartCapsule, cleanSequence, rawTokens]);

  const previewPayload = useMemo(() => {
    if (previewTab === "smart") return smartCapsule.optimized;
    if (previewTab === "clean") return cleanSequence.optimized;
    return capsule.content;
  }, [previewTab, smartCapsule, cleanSequence, capsule.content]);

  const hasBigSavings = rawTokens > 1000 && smartCapsule.savedTokens > 500;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activePayload);
      setCopied(true);

      if (transferMode === "smart" && smartCapsule.savedTokens > 0) {
        onShowToast(
          `Copied Smart Capsule! Saved ${smartCapsule.savedTokens} tokens (-${smartCapsule.savingsPercent}%) ⚡`,
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

    const result = await injectCapsuleIntoActiveTab(activePayload);
    setIsInjecting(false);

    if (result.success) {
      setInjectSuccess(true);
      if (transferMode === "smart" && smartCapsule.savedTokens > 0) {
        onShowToast(
          `Injected Smart Capsule! Saved ${smartCapsule.savedTokens} tokens (-${smartCapsule.savingsPercent}%) into active chat! 🚀`,
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

  const handleDistillInPlace = async () => {
    if (!onUpdateCapsule) return;
    try {
      setIsDistilling(true);
      await onUpdateCapsule({
        ...capsule,
        content: smartCapsule.optimized
      });
      onShowToast(
        `Distilled into Smart Capsule! Saved ${smartCapsule.savedTokens} tokens (-${smartCapsule.savingsPercent}%) permanently!`,
        "success"
      );
    } catch {
      onShowToast("Failed to save distilled revision", "error");
    } finally {
      setIsDistilling(false);
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

          {/* Real-time Token Badge: Shows smart optimized vs raw */}
          <span
            title={`Raw chat: ${formatTokenCount(rawTokens)} (${capsule.content.length} chars) | Smart Capsule: ${formatTokenCount(smartCapsule.optimizedTokens)} (Saves ${smartCapsule.savedTokens} tokens)`}
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
              transferMode === "smart" && hasBigSavings
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-indigo-50/90 text-indigo-700 border-indigo-200/70"
            }`}
          >
            <Zap className={`w-2.5 h-2.5 ${transferMode === "smart" ? "fill-emerald-600 text-emerald-600" : "fill-indigo-600 text-indigo-600"}`} />
            <span>{formatTokenCount(activeTokens)}</span>
            {transferMode === "smart" && hasBigSavings && (
              <span className="text-[9px] bg-emerald-200/70 text-emerald-900 px-1 rounded-sm font-bold">
                -{smartCapsule.savingsPercent}%
              </span>
            )}
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
          {/* Quick Distill Action if chat is large */}
          {hasBigSavings && onUpdateCapsule && (
            <button
              onClick={handleDistillInPlace}
              disabled={isDistilling}
              title={`Permanently compress into a Smart Capsule (saves ${smartCapsule.savedTokens} tokens)`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
            >
              <Zap className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
              <span>Distill (-{formatTokenCount(smartCapsule.savedTokens)})</span>
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
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
            {/* View Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-[10px] shadow-2xs">
              <button
                onClick={() => setPreviewTab("smart")}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  previewTab === "smart"
                    ? "bg-white text-emerald-700 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                ⚡ Smart Capsule (~{formatTokenCount(smartCapsule.optimizedTokens)})
              </button>
              <button
                onClick={() => setPreviewTab("clean")}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  previewTab === "clean"
                    ? "bg-white text-indigo-700 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Clean Turns
              </button>
              <button
                onClick={() => setPreviewTab("raw")}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  previewTab === "raw"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Raw ({formatTokenCount(rawTokens)})
              </button>
            </div>

            <span className="text-[10px] text-slate-400 font-mono">
              {previewTab === "smart" && hasBigSavings
                ? `Saved ${formatTokenCount(smartCapsule.savedTokens)} tokens!`
                : `${capsule.content.length} chars`}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg text-slate-800 text-[11px] font-mono leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap select-text border border-slate-200/60">
            {previewPayload}
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
                : transferMode === "smart" && hasBigSavings
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow"
            }`}
            title={
              transferMode === "smart"
                ? `Inject ultra-low token Smart Capsule (${formatTokenCount(smartCapsule.optimizedTokens)}, saves ${smartCapsule.savedTokens} tokens)`
                : "Inject context into active input"
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
              transferMode === "smart"
                ? `Copy Smart Capsule (${formatTokenCount(smartCapsule.optimizedTokens)})`
                : "Copy prompt context to clipboard"
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* 3-Tier Mode Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-[10px] font-semibold">
            <button
              onClick={() => setTransferMode("smart")}
              className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                transferMode === "smart"
                  ? "bg-emerald-600 text-white shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Smart Capsule: distills previous 30+ turns into key rules, code, and active task (80%-95% token savings)"
            >
              ⚡ Smart
            </button>
            <button
              onClick={() => setTransferMode("clean")}
              className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                transferMode === "clean"
                  ? "bg-indigo-600 text-white shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Clean Turns: full conversation sequence with pleasantries and filler removed"
            >
              Turns
            </button>
            <button
              onClick={() => setTransferMode("raw")}
              className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                transferMode === "raw"
                  ? "bg-slate-700 text-white shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Raw: untouched original text payload"
            >
              Raw
            </button>
          </div>
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

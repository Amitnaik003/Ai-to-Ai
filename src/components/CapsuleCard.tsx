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
  Zap,
  MoreHorizontal,
  FileText,
  ListOrdered
} from "lucide-react";
import type { Capsule, PlatformType } from "../types";
import { injectCapsuleIntoActiveTab } from "../utils/activeTab";
import {
  estimateTokenCount,
  formatTokenCount,
  buildStructuredContext,
  distillSmartCapsule,
} from "../utils/tokenOptimizer";

interface CapsuleCardProps {
  capsule: Capsule;
  onEdit: (capsule: Capsule) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
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

type TransferMode = "smart" | "clean" | "raw";

/* ─── Overflow Menu ────────────────────────────────────────────────────── */
const OverflowMenu: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
  hasHistory: boolean;
}> = ({ onEdit, onDelete, onHistory, hasHistory }) => {
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
        <div className="absolute right-0 top-7 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-36 animate-fade-in">
          {hasHistory && (
            <button
              onClick={() => { onHistory(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          )}
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 transition"
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
  onShowToast,
  onUpdateCapsule
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectSuccess, setInjectSuccess] = useState(false);
  const [transferMode, setTransferMode] = useState<TransferMode>("clean");
  const [previewTab, setPreviewTab] = useState<TransferMode>("clean");

  const meta = PLATFORM_META[capsule.platform] || PLATFORM_META.manual;

  // ── Token calculations ──────────────────────────────────────────────
  const rawTokens = useMemo(
    () => estimateTokenCount(capsule.content),
    [capsule.content]
  );

  const smartCapsule = useMemo(
    () =>
      distillSmartCapsule(capsule.messages || capsule.content, {
        sourcePlatform: capsule.platform.toUpperCase(),
        title: capsule.title,
        summary: capsule.summary
      }),
    [capsule]
  );

  const cleanSequence = useMemo(
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

  // ── Handlers ───────────────────────────────────────────────────────
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activePayload);
      setCopied(true);
      const label =
        transferMode === "clean"
          ? "Full structured sequence copied!"
          : transferMode === "smart"
          ? `Condensed capsule copied (${formatTokenCount(smartCapsule.optimizedTokens)})!`
          : "Raw context copied!";
      onShowToast(label, "success");
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
        transferMode === "smart"
          ? "Condensed capsule injected! 🚀"
          : transferMode === "raw"
          ? "Raw context injected!"
          : "Full structured sequence injected! 🚀",
        "success"
      );
      setTimeout(() => setInjectSuccess(false), 2500);
    } else {
      onShowToast(result.error || "Could not inject into page", "error");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div
      className={`group relative card-glass rounded-xl border transition-all duration-200 overflow-hidden
        ${meta.stripe}
        ${
          capsule.isPinned
            ? "border-amber-200 shadow-md shadow-amber-100/60"
            : "border-slate-200/90 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/70"
        }
        animate-card
      `}
    >
      {/* ── Top row: badges + controls ──────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-0">
        {/* Left: Platform badge + token count + version + date */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Platform pill */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
            {meta.label}
          </span>

          {/* Token count badge */}
          <span
            title={`~${activeTokens} tokens · ${capsule.content.length} chars`}
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100"
          >
            <Zap className="w-2.5 h-2.5 fill-indigo-500 text-indigo-500 shrink-0" />
            {formatTokenCount(activeTokens)}
          </span>

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

        {/* Right: Pin + overflow menu + expand */}
        <div className="flex items-center gap-0.5 shrink-0">
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

          <OverflowMenu
            onEdit={() => onEdit(capsule)}
            onDelete={() => onDelete(capsule.id)}
            onHistory={() => {
              setIsExpanded(true);
              setShowHistory((v) => !v);
            }}
            hasHistory={!!(capsule.history && capsule.history.length > 0)}
          />

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

      {/* ── Title + Summary ─────────────────────────────────────────── */}
      <div className="px-3.5 pt-2 pb-1">
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
              {(
                [
                  { id: "clean", icon: <ListOrdered className="w-3 h-3" />, label: "Sequence" },
                  { id: "raw",   icon: <FileText className="w-3 h-3" />,    label: "Raw" },
                  { id: "smart", icon: <Zap className="w-3 h-3" />,         label: "⚡ Smart" }
                ] as { id: TransferMode; icon: React.ReactNode; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPreviewTab(tab.id)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                    previewTab === tab.id
                      ? tab.id === "smart"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : tab.id === "raw"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-[10px] text-slate-400 font-mono pr-1">
              {previewTab === "smart" && hasBigSavings
                ? `−${formatTokenCount(smartCapsule.savedTokens)} saved`
                : `${capsule.content.length} chars`}
            </span>
          </div>

          {/* Preview body */}
          <div className="p-2.5 text-[11px] font-mono leading-relaxed text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap select-text">
            {previewPayload}
          </div>

          {/* History pane */}
          {showHistory && capsule.history && capsule.history.length > 0 && (
            <div className="border-t border-slate-200/70 px-2.5 py-2 space-y-1.5 max-h-32 overflow-y-auto bg-white/60">
              <p className="text-[10px] font-bold text-slate-600 mb-1">
                Version History ({capsule.history.length})
              </p>
              {capsule.history.map((rev) => (
                <div
                  key={rev.version}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-[10px]"
                >
                  <div className="flex justify-between text-slate-500 font-semibold mb-0.5">
                    <span>v{rev.version}</span>
                    <span>{new Date(rev.updatedAt).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-700 line-clamp-2 leading-snug">
                    {rev.summary || rev.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom action bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 pb-3 pt-1.5 gap-2">
        {/* Left: Inject + Copy */}
        <div className="flex items-center gap-1.5">
          {/* Inject — primary CTA */}
          <button
            onClick={handleInject}
            disabled={isInjecting}
            className={`btn-inject flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer ${
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
        </div>

        {/* Right: Transfer mode selector */}
        <div className="flex items-center bg-slate-100 border border-slate-200/80 p-0.5 rounded-lg gap-px">
          {(
            [
              { mode: "clean", label: "Seq",         activeClass: "text-indigo-700" },
              { mode: "raw",   label: "Raw",         activeClass: "text-slate-800"  },
              { mode: "smart", label: "⚡",          activeClass: "text-emerald-700" }
            ] as { mode: TransferMode; label: string; activeClass: string }[]
          ).map((item) => (
            <button
              key={item.mode}
              onClick={() => setTransferMode(item.mode)}
              title={
                item.mode === "clean"
                  ? "Full Sequence: all turns preserved"
                  : item.mode === "raw"
                  ? "Raw: original untouched text"
                  : "⚡ Condensed: key rules + code only"
              }
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                transferMode === item.mode
                  ? `bg-white shadow-sm ${item.activeClass}`
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

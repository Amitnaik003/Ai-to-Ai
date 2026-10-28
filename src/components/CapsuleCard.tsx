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
  MoreHorizontal,
  FileText,
  ListOrdered,
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

/* ─── Overflow Menu ────────────────────────────────────────────────────── */
const OverflowMenu: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
}> = ({ onEdit, onDelete }) => {
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
        <div className="absolute right-0 top-7 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-36 animate-fade-in text-xs">
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
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
  onShowToast
}) => {
  const [copied, setCopied] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const meta = PLATFORM_META[capsule.platform] || PLATFORM_META.manual;

  // Turn metrics
  const stats = useMemo(
    () => getConversationStats(capsule.messages || capsule.content),
    [capsule.messages, capsule.content]
  );

  // Structured XML sequence
  const structuredSequence = useMemo(() => {
    const res = buildStructuredContext(capsule.messages || capsule.content, {
      formatMode: "xml",
      sourcePlatform: capsule.platform.toUpperCase(),
      title: capsule.title,
      summary: capsule.summary,
      includeHandoff: true
    });
    return res.optimized;
  }, [capsule]);

  const activePayload = useMemo(() => {
    return structuredSequence || capsule.content;
  }, [structuredSequence, capsule.content]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activePayload);
      setCopied(true);
      onShowToast("Context copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast("Failed to copy context", "error");
    }
  };

  // Direct injection into destination LLM tab
  const handleInject = async () => {
    setInjecting(true);
    try {
      const result = await injectCapsuleIntoActiveTab(activePayload);
      if (result.success) {
        onShowToast("Context transferred directly into active prompt!", "success");
      } else {
        onShowToast(result.error || "Injection target unavailable. Copying to clipboard instead.", "error");
        await navigator.clipboard.writeText(activePayload);
      }
    } catch (err: any) {
      onShowToast(err.message || "Failed to inject context", "error");
    } finally {
      setInjecting(false);
    }
  };

  // HTML5 Drag and Drop context transfer
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData("text/plain", activePayload);
    const payloadStr = JSON.stringify({
      id: capsule.id,
      title: capsule.title,
      content: activePayload,
      platform: capsule.platform
    });
    e.dataTransfer.setData("application/x-promptwarp", payloadStr);
    e.dataTransfer.setData("application/x-ai-to-ai", payloadStr);
    e.dataTransfer.setData("application/x-capsule-hub", payloadStr);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group relative bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden ${
        capsule.isPinned ? "bg-amber-50/10 border-amber-200/70" : ""
      } ${isDragging ? "opacity-40 scale-[0.99] border-dashed border-indigo-400" : ""}`}
    >
      {/* Platform color stripe */}
      <div className={`h-0.5 w-full ${meta.stripe}`} />

      {/* Card Header */}
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between gap-1 mb-1.5">
          {/* Left: Drag Handle + Platform Badge + Turns Count */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Drag Handle */}
            <div
              title="Drag & drop this context directly into any AI chat input"
              className="p-0.5 -ml-1 text-slate-300 hover:text-indigo-600 cursor-grab active:cursor-grabbing transition"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            {/* Platform pill */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>

            {/* Turn Counter Badge */}
            <span
              title={`Dialogue turns: ${stats.totalMessages} turns (${stats.userMessages} user · ${stats.assistantMessages} AI)`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60"
            >
              <MessageSquare className="w-2.5 h-2.5 text-slate-500" />
              <span>{stats.label}</span>
            </span>
          </div>

          {/* Right: Pin & Overflow Menu */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Pin */}
            <button
              onClick={() => onTogglePin(capsule.id)}
              title={capsule.isPinned ? "Unpin" : "Pin to top"}
              className={`p-1 rounded-md transition cursor-pointer ${
                capsule.isPinned
                  ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
                  : "text-slate-300 hover:text-amber-500 hover:bg-slate-100"
              }`}
            >
              <Pin className={`w-3.5 h-3.5 ${capsule.isPinned ? "fill-amber-500" : ""}`} />
            </button>

            {/* Overflow */}
            <OverflowMenu
              onEdit={() => onEdit(capsule)}
              onDelete={() => onDelete(capsule.id)}
            />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 mt-1">
          {capsule.title}
        </h2>

        {/* Summary */}
        {capsule.summary && (
          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
            {capsule.summary}
          </p>
        )}

        {/* Tags */}
        {capsule.tags && capsule.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {capsule.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Turn Preview */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-2.5 animate-fade-in text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-0.5">
            <span className="flex items-center gap-1">
              <ListOrdered className="w-3 h-3 text-indigo-500" />
              <span>{stats.totalMessages} Turns Sequence</span>
            </span>
            <span className="text-[10px] text-slate-400">
              {activePayload.length.toLocaleString()} chars
            </span>
          </div>

          <pre className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] text-slate-700 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
            {activePayload}
          </pre>
        </div>
      )}

      {/* Card Actions Footer */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50/50 border-t border-slate-100 text-xs">
        {/* Left: Expand Preview Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 font-medium transition cursor-pointer"
        >
          <FileText className="w-3 h-3 text-slate-400" />
          <span>{expanded ? "Hide Preview" : "Preview"}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Right: Copy & Inject Actions */}
        <div className="flex items-center gap-1.5">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title="Copy formatted context"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Inject Button */}
          <button
            onClick={handleInject}
            disabled={injecting}
            title="Inject directly into active browser tab"
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            <span>{injecting ? "Injecting…" : "Inject"}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

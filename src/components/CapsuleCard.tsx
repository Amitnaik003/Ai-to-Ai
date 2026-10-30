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
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Download,
  Clock,
  CheckSquare,
  Square,
  FileCode,
  Sparkles
} from "lucide-react";
import type { Capsule, PlatformType } from "../types";
import { injectCapsuleIntoActiveTab } from "../utils/activeTab";
import { buildStructuredContext, getConversationStats } from "../utils/contextFormatter";
import { scanSecurity, redactSensitiveData } from "../utils/securityScanner";
import {
  downloadCapsuleAsMarkdown,
  downloadCapsuleAsJSON,
  formatCapsuleToMarkdown
} from "../utils/fileExporter";

interface CapsuleCardProps {
  capsule: Capsule;
  onEdit: (capsule: Capsule) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  onUpdateCapsule?: (capsule: Capsule) => Promise<Capsule | void>;
  isBatchMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
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
  capsule: Capsule;
  onEdit: () => void;
  onDelete: () => void;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  onDownloadJSON: () => void;
}> = ({
  capsule,
  onEdit,
  onDelete,
  onCopyMarkdown,
  onDownloadMarkdown,
  onDownloadJSON
}) => {
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
        title="More actions"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-44 animate-fade-in text-xs">
          <button
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Edit Context</span>
          </button>

          <button
            onClick={() => {
              onCopyMarkdown();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy as Markdown</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          {/* Desktop Downloads */}
          <button
            onClick={() => {
              onDownloadMarkdown();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save as .md</span>
          </button>

          <button
            onClick={() => {
              onDownloadJSON();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition"
          >
            <FileCode className="w-3.5 h-3.5 text-slate-400" />
            <span>Save as .json</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          <button
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
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
  onShowToast,
  onUpdateCapsule,
  isBatchMode = false,
  isSelected = false,
  onToggleSelect
}) => {
  const [copied, setCopied] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);

  const meta = PLATFORM_META[capsule.platform] || PLATFORM_META.manual;

  // Turn metrics, word count, reading time
  const stats = useMemo(
    () => getConversationStats(capsule.messages || capsule.content),
    [capsule.messages, capsule.content]
  );

  // Structured XML sequence for LLM ingestion
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

  // Real-time security audit
  const securityAudit = useMemo(
    () => scanSecurity(activePayload),
    [activePayload]
  );

  const handleMaskSecrets = async () => {
    const { sanitized, redactedCount } = redactSensitiveData(capsule.content);
    if (redactedCount > 0 && onUpdateCapsule) {
      const updated: Capsule = {
        ...capsule,
        content: sanitized,
        summary: capsule.summary ? redactSensitiveData(capsule.summary).sanitized : capsule.summary,
        updatedAt: new Date().toISOString()
      };
      await onUpdateCapsule(updated);
      setShowSecurityDetails(false);
      onShowToast(`Masked ${redactedCount} sensitive credential(s)! 🛡️`, "success");
    }
  };

  // Copy to clipboard as structured XML
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

  // Copy to clipboard as clean Markdown
  const handleCopyMarkdown = async () => {
    try {
      const md = formatCapsuleToMarkdown(capsule);
      await navigator.clipboard.writeText(md);
      onShowToast("Copied as formatted Markdown!", "success");
    } catch {
      onShowToast("Failed to copy Markdown", "error");
    }
  };

  // Direct Desktop Download (.md)
  const handleDownloadMarkdown = () => {
    try {
      downloadCapsuleAsMarkdown(capsule);
      onShowToast("Saved .md file to your desktop downloads!", "success");
    } catch (err: any) {
      onShowToast(err.message || "Failed to download Markdown", "error");
    }
  };

  // Direct Desktop Download (.json)
  const handleDownloadJSON = () => {
    try {
      downloadCapsuleAsJSON(capsule);
      onShowToast("Saved .json backup to your desktop downloads!", "success");
    } catch (err: any) {
      onShowToast(err.message || "Failed to download JSON", "error");
    }
  };

  // Direct injection into destination LLM tab
  const handleInject = async () => {
    if (!securityAudit.isSecure) {
      const proceed = window.confirm(
        `⚠️ Security Alert: This context contains ${securityAudit.totalSecrets} unmasked secret(s) (${securityAudit.findings.map((f) => f.label).join(", ")}).\n\nAre you sure you want to inject without masking?`
      );
      if (!proceed) return;
    }

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
    if (isBatchMode) {
      e.preventDefault();
      return;
    }
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
      draggable={!isBatchMode}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group relative bg-white rounded-xl border transition-all overflow-hidden ${
        isSelected
          ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10"
          : capsule.isPinned
          ? "border-amber-300/80 bg-amber-50/10 shadow-2xs"
          : "border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300"
      } ${isDragging ? "opacity-40 scale-[0.99] border-dashed border-indigo-400" : ""}`}
    >
      {/* Platform color stripe */}
      <div className={`h-0.5 w-full ${meta.stripe}`} />

      {/* Card Header */}
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between gap-1 mb-1.5">
          {/* Left: Batch Checkbox OR Drag Handle + Platform Badge + Metrics */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {isBatchMode ? (
              <button
                type="button"
                onClick={() => onToggleSelect && onToggleSelect(capsule.id)}
                className="p-0.5 -ml-1 text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 fill-indigo-50 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>
            ) : (
              <div
                title="Drag & drop this context directly into any AI chat input"
                className="p-0.5 -ml-1 text-slate-300 hover:text-indigo-600 cursor-grab active:cursor-grabbing transition"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
            )}

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

            {/* Reading Time / Words metric (Zero tokens!) */}
            {stats.wordCount > 0 && (
              <span
                title={`${stats.wordCount.toLocaleString()} words · ~${stats.readingTimeMin} min read time`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] text-slate-500 bg-slate-50 border border-slate-200/60 font-medium"
              >
                <Clock className="w-2.5 h-2.5 text-slate-400" />
                <span>{stats.wordCount > 999 ? `${(stats.wordCount / 1000).toFixed(1)}k words` : `${stats.wordCount} words`}</span>
              </span>
            )}

            {/* Security Alert Badge */}
            {!securityAudit.isSecure && (
              <button
                type="button"
                onClick={() => setShowSecurityDetails(!showSecurityDetails)}
                title={`Click to view and mask ${securityAudit.totalSecrets} detected secret(s)`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
              >
                <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
                <span>{securityAudit.totalSecrets} Secret{securityAudit.totalSecrets > 1 ? "s" : ""}</span>
              </button>
            )}
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
              capsule={capsule}
              onEdit={() => onEdit(capsule)}
              onDelete={() => onDelete(capsule.id)}
              onCopyMarkdown={handleCopyMarkdown}
              onDownloadMarkdown={handleDownloadMarkdown}
              onDownloadJSON={handleDownloadJSON}
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

      {/* Security Details Popover Drawer */}
      {showSecurityDetails && !securityAudit.isSecure && (
        <div className="border-t border-rose-100 bg-rose-50/60 p-2.5 animate-fade-in text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-rose-800">
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Detected Secrets ({securityAudit.totalSecrets})</span>
            </span>
            {onUpdateCapsule && (
              <button
                onClick={handleMaskSecrets}
                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10px] shadow-2xs transition cursor-pointer"
              >
                Mask All
              </button>
            )}
          </div>
          <div className="space-y-1">
            {securityAudit.findings.map((f, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white/80 p-1.5 rounded border border-rose-200/80 text-[10px]">
                <span className="font-semibold text-rose-900">{f.label}</span>
                <code className="text-[9px] text-slate-600 bg-slate-100 px-1 py-0.2 rounded font-mono">{f.snippet}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Turn Preview */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-2.5 animate-fade-in text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-0.5">
            <span className="flex items-center gap-1">
              <ListOrdered className="w-3 h-3 text-indigo-500" />
              <span>{stats.detailedLabel}</span>
            </span>
            <span className="text-[10px] text-slate-400">
              {stats.charCount.toLocaleString()} chars · ~{stats.readingTimeMin}m read
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

        {/* Right: Quick Markdown Save + Copy & Inject Actions */}
        <div className="flex items-center gap-1.5">
          {/* Quick Markdown Download */}
          <button
            onClick={handleDownloadMarkdown}
            title="Download context directly as a Markdown .md file to your desktop"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
          >
            <Download className="w-3 h-3 text-slate-500" />
            <span className="hidden sm:inline">.md</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title="Copy structured context to clipboard"
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

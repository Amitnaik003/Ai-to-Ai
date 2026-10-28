import React, { useState, useEffect, useMemo } from "react";
import { X, Save, Sparkles, RotateCcw, CheckCircle2, MessageSquare } from "lucide-react";
import type { Capsule, PlatformType } from "../types";
import {
  buildStructuredContext,
  getConversationStats,
  cleanTextContent,
  StructureFormatMode
} from "../utils/contextFormatter";

interface CapsuleEditorModalProps {
  capsule: Capsule | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (saved: Capsule) => void;
}

export const CapsuleEditorModal: React.FC<CapsuleEditorModalProps> = ({
  capsule,
  isOpen,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<PlatformType>("manual");
  const [tagsInput, setTagsInput] = useState("");
  const [feedback, setFeedback] = useState<{
    message: string;
    prevContent: string;
  } | null>(null);

  useEffect(() => {
    if (capsule) {
      setTitle(capsule.title || "");
      setSummary(capsule.summary || "");
      setContent(capsule.content || "");
      setPlatform(capsule.platform || "manual");
      setTagsInput(capsule.tags ? capsule.tags.join(", ") : "");
    } else {
      setTitle("");
      setSummary("");
      setContent("");
      setPlatform("manual");
      setTagsInput("");
    }
    setFeedback(null);
  }, [capsule, isOpen]);

  if (!isOpen) return null;

  const stats = useMemo(() => getConversationStats(content), [content]);

  const handleStructureAndSequence = (mode: StructureFormatMode = "xml", aggressive = false) => {
    if (!content.trim()) return;

    const result = buildStructuredContext(content, {
      formatMode: mode,
      sourcePlatform: platform === "manual" ? "Context Transfer" : platform.toUpperCase(),
      title: title.trim(),
      summary: summary.trim(),
      includeHandoff: true,
      aggressive
    });

    setFeedback({
      message: "Context structured and ordered cleanly!",
      prevContent: content
    });
    setContent(result.optimized);
  };

  const handleCleanWhitespace = () => {
    if (!content.trim()) return;
    const cleaned = cleanTextContent(content);
    setFeedback({
      message: "Cleaned whitespace and trailing fluff!",
      prevContent: content
    });
    setContent(cleaned);
  };

  const handleUndo = () => {
    if (feedback?.prevContent) {
      setContent(feedback.prevContent);
      setFeedback(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const generatedSummary = summary.trim()
      ? summary.trim()
      : content.trim().slice(0, 140) + (content.length > 140 ? "..." : "");

    const toSave: Capsule = {
      ...(capsule || {
        id: `cap-${Date.now()}`,
        createdAt: new Date().toISOString(),
        isPinned: false
      }),
      title: title.trim(),
      summary: generatedSummary,
      content: content.trim(),
      platform,
      tags: parsedTags,
      updatedAt: new Date().toISOString()
    };

    onSave(toSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">
              {capsule ? "Edit Context" : "Create New Context"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Next.js Staff Architect Prompt"
              className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Platform Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Target Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlatformType)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition font-medium"
            >
              <option value="chatgpt">ChatGPT</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="perplexity">Perplexity</option>
              <option value="deepseek">DeepSeek</option>
              <option value="gmail">Gmail</option>
              <option value="manual">Custom / Generic</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. system-prompt, coding, react"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Brief Summary (Optional)
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short description of this prompt or context"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Context Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Prompt / Conversation Content *
              </label>

              {/* Turn count & stats */}
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                  <MessageSquare className="w-2.5 h-2.5" />
                  <span>{stats.label}</span>
                </span>
                <span>{content.length.toLocaleString()} chars</span>
              </div>
            </div>

            {/* Quick Formatting Toolbar */}
            <div className="flex items-center justify-between gap-1 mb-2 bg-slate-100/80 p-1.5 rounded-lg border border-slate-200/60">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStructureAndSequence("xml")}
                  title="Format into chronological XML turns"
                  className="px-2 py-1 rounded text-[10px] font-semibold bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 shadow-2xs transition cursor-pointer"
                >
                  XML Turns
                </button>
                <button
                  type="button"
                  onClick={() => handleStructureAndSequence("sequence")}
                  title="Format as plain turn sequence (User: / Assistant:)"
                  className="px-2 py-1 rounded text-[10px] font-semibold bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 shadow-2xs transition cursor-pointer"
                >
                  Sequence
                </button>
                <button
                  type="button"
                  onClick={handleCleanWhitespace}
                  title="Clean whitespace and trailing fluff"
                  className="px-2 py-1 rounded text-[10px] font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-2xs transition cursor-pointer"
                >
                  Clean Whitespace
                </button>
              </div>

              {feedback && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline cursor-pointer font-medium"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Undo</span>
                </button>
              )}
            </div>

            {feedback && (
              <div className="mb-2 p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{feedback.message}</span>
              </div>
            )}

            <textarea
              required
              rows={9}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your prompt, system instructions, or multi-turn conversation dialogue here..."
              className="w-full p-3 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition font-mono leading-relaxed resize-y"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Context</span>
          </button>
        </div>
      </div>
    </div>
  );
};

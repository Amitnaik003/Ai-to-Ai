import React, { useState, useEffect } from "react";
import { X, Save, Sparkles, Folder as FolderIcon, Zap, RotateCcw, CheckCircle2, ListOrdered, Code2 } from "lucide-react";
import type { Capsule, Folder, PlatformType } from "../types";
import {
  estimateTokenCount,
  formatTokenCount,
  buildStructuredContext,
  optimizeContext,
  StructureFormatMode,
  OptimizationResult
} from "../utils/tokenOptimizer";

interface CapsuleEditorModalProps {
  capsule: Capsule | null;
  folders: Folder[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (saved: Capsule) => void;
}

export const CapsuleEditorModal: React.FC<CapsuleEditorModalProps> = ({
  capsule,
  folders,
  isOpen,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<PlatformType>("manual");
  const [folderId, setFolderId] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<StructureFormatMode>("xml");

  const [feedback, setFeedback] = useState<{
    originalTokens: number;
    optimizedTokens: number;
    savedTokens: number;
    savingsPercent: number;
    turnsCount?: number;
    prevContent: string;
  } | null>(null);

  useEffect(() => {
    if (capsule) {
      setTitle(capsule.title || "");
      setSummary(capsule.summary || "");
      setContent(capsule.content || "");
      setPlatform(capsule.platform || "manual");
      setFolderId(capsule.folderId || "");
      setTagsInput(capsule.tags ? capsule.tags.join(", ") : "");
    } else {
      setTitle("");
      setSummary("");
      setContent("");
      setPlatform("manual");
      setFolderId("");
      setTagsInput("");
    }
    setFeedback(null);
  }, [capsule, isOpen]);

  if (!isOpen) return null;

  const currentTokenCount = estimateTokenCount(content);

  const handleStructureAndSequence = (mode: StructureFormatMode = selectedFormat, aggressive = false) => {
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
      originalTokens: result.originalTokens,
      optimizedTokens: result.optimizedTokens,
      savedTokens: result.savedTokens,
      savingsPercent: result.savingsPercent,
      prevContent: content
    });
    setContent(result.optimized);
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
        version: 1,
        createdAt: new Date().toISOString(),
        isPinned: false
      }),
      title: title.trim(),
      summary: generatedSummary,
      content: content.trim(),
      platform,
      folderId: folderId || undefined,
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
              {capsule ? "Edit Context Capsule" : "Create New Capsule"}
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

          {/* Platform & Folder Selectors */}
          <div className="grid grid-cols-2 gap-3">
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
                <option value="gmail">Gmail</option>
                <option value="manual">Custom / Generic</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Folder
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition font-medium"
              >
                <option value="">No Folder (Unfiled)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
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

          {/* Prompt / Context Payload with Live Token Optimization & Structured Formatting */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Prompt / Context Content *
              </label>
              <div className="flex items-center gap-2">
                <span
                  title="Estimated LLM prompt tokens (GPT-4o, Claude 3.5, Gemini 1.5)"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full"
                >
                  <Zap className="w-2.5 h-2.5 fill-indigo-600 text-indigo-600" />
                  {formatTokenCount(currentTokenCount)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {content.length.toLocaleString()} chars
                </span>
              </div>
            </div>

            {/* Structure & Token Saver Toolbar */}
            <div className="mb-2 p-2.5 bg-gradient-to-r from-indigo-50/80 via-slate-50 to-emerald-50/60 border border-indigo-100 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-800 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Structured Sequence Formatter</span>
                </div>

                {/* Format Mode Selector */}
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-medium shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSelectedFormat("xml")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      selectedFormat === "xml"
                        ? "bg-indigo-600 text-white font-semibold shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Structured XML tags (<context_transfer>, <dialogue_sequence>, <turn>) - Best for Claude & GPT-4o"
                  >
                    XML Tags
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFormat("sequence")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      selectedFormat === "sequence"
                        ? "bg-indigo-600 text-white font-semibold shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Numbered Turn Sequence ([Turn 1 · User], [Turn 2 · Assistant])"
                  >
                    Sequence
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFormat("compact")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      selectedFormat === "compact"
                        ? "bg-indigo-600 text-white font-semibold shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Compact Dialogue ([User]: ..., [Assistant]: ...) with minimal tokens"
                  >
                    Compact
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-indigo-100/70">
                <span className="text-[10px] text-slate-500">
                  Orders turns chronologically & removes conversational pleasantries
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStructureAndSequence(selectedFormat, false)}
                    disabled={!content.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    title="Organize into structured chronological turns and minimize tokens"
                  >
                    <ListOrdered className="w-3 h-3" />
                    <span>⚡ Structure & Sequence</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStructureAndSequence(selectedFormat, true)}
                    disabled={!content.trim()}
                    title="Aggressive compression: tightly compresses line breaks and whitespace"
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span>Max Compress</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Feedback Banner if structured/optimized */}
            {feedback && (
              <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-[11px] text-emerald-800 animate-in fade-in">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {feedback.savedTokens > 0 ? (
                    <span>
                      Structured & ordered! Saved <strong>{feedback.savedTokens} tokens</strong> ({feedback.savingsPercent}% reduction: {feedback.originalTokens} ➔ {feedback.optimizedTokens} tokens)
                    </span>
                  ) : (
                    <span>Context formatted in correct sequence with zero filler!</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleUndo}
                  className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 underline ml-2 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Undo
                </button>
              </div>
            )}

            <textarea
              required
              rows={8}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (feedback) setFeedback(null);
              }}
              placeholder="Paste full prompt, system instructions, or multi-turn chat here..."
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-y leading-relaxed"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-300 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{capsule ? "Save Changes" : "Create Capsule"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

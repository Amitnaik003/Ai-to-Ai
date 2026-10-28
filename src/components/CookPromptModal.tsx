import React, { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  Flame,
  Check,
  Copy,
  Send,
  Zap,
  Award,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import {
  COOK_RECIPES,
  CookRecipeId,
  cookPrompt,
  CookedPromptResult
} from "../utils/promptCooker";
import { formatTokenCount } from "../utils/tokenOptimizer";
import { injectCapsuleIntoActiveTab } from "../utils/activeTab";
import type { Capsule } from "../types";

interface CookPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  capsuleTitle?: string;
  sourceCapsule?: Capsule | null;
  onApplyCookedText?: (newContent: string) => void;
  onSaveAsGoldenCapsule?: (title: string, content: string) => Promise<void>;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const CookPromptModal: React.FC<CookPromptModalProps> = ({
  isOpen,
  onClose,
  initialText,
  capsuleTitle = "Context Prompt",
  sourceCapsule,
  onApplyCookedText,
  onSaveAsGoldenCapsule,
  onShowToast
}) => {
  const [selectedRecipe, setSelectedRecipe] = useState<CookRecipeId>("golden_standard");
  const [copied, setCopied] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectSuccess, setInjectSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const cookedResult: CookedPromptResult = useMemo(() => {
    return cookPrompt(initialText || "", selectedRecipe, {
      contextSummary: sourceCapsule?.summary,
      targetPlatform: sourceCapsule?.platform
    });
  }, [initialText, selectedRecipe, sourceCapsule]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cookedResult.cookedText);
      setCopied(true);
      onShowToast("Cooked prompt copied to clipboard! 🍳", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast("Failed to copy", "error");
    }
  };

  const handleInject = async () => {
    setIsInjecting(true);
    setInjectSuccess(false);
    const res = await injectCapsuleIntoActiveTab(cookedResult.cookedText);
    setIsInjecting(false);

    if (res.success) {
      setInjectSuccess(true);
      onShowToast("Cooked prompt injected into chat! 🚀", "success");
      setTimeout(() => {
        setInjectSuccess(false);
        onClose();
      }, 1500);
    } else {
      onShowToast(res.error || "Could not inject into chat box", "error");
    }
  };

  const handleSaveGolden = async () => {
    if (!onSaveAsGoldenCapsule) return;
    try {
      setIsSaving(true);
      const title = `🏆 Golden: ${capsuleTitle.replace(/^🏆 Golden:\s*/, "")}`;
      await onSaveAsGoldenCapsule(title, cookedResult.cookedText);
      onShowToast("Saved as Golden Prompt in your library!", "success");
      onClose();
    } catch {
      onShowToast("Failed to save Golden Prompt", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApply = () => {
    if (onApplyCookedText) {
      onApplyCookedText(cookedResult.cookedText);
      onShowToast("Cooked prompt applied to editor!", "success");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-indigo-500/5 to-purple-500/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm shadow-orange-300">
              <Flame className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Cook This Prompt
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Tilantra Style
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Elevate and structure your prompt into frontier LLM benchmark standard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recipe Selection Strip */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Select Enhancement Recipe
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {COOK_RECIPES.map((recipe) => {
              const isSelected = selectedRecipe === recipe.id;
              return (
                <button
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe.id)}
                  className={`flex flex-col items-start p-2 rounded-xl text-left border transition cursor-pointer ${
                    isSelected
                      ? "bg-white border-amber-500 shadow-md ring-1 ring-amber-500/30 text-slate-900"
                      : "bg-white/70 border-slate-200/80 hover:bg-white hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-1 text-xs mb-0.5">
                    <span>{recipe.icon}</span>
                    <span className="font-bold truncate text-[11px]">{recipe.name}</span>
                  </div>
                  <span className="text-[9px] text-slate-400 line-clamp-1">
                    {recipe.tagline}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {/* Key Enhancements Pill List */}
          <div className="p-2.5 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Recipe Upgrades Applied:
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                {formatTokenCount(cookedResult.cookedTokens)} (
                {cookedResult.tokenDelta >= 0 ? `+${cookedResult.tokenDelta}` : cookedResult.tokenDelta} tokens
                )
              </span>
            </div>
            <ul className="text-[11px] text-amber-800 space-y-0.5 pl-4 list-disc">
              {cookedResult.highlightPoints.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          </div>

          {/* Cooked Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Cooked Prompt Preview
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {cookedResult.cookedText.length} characters
              </span>
            </div>
            <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap select-text border border-slate-800 shadow-inner">
              {cookedResult.cookedText}
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5">
            {onApplyCookedText && (
              <button
                onClick={handleApply}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
              >
                <span>Apply to Editor</span>
              </button>
            )}

            {onSaveAsGoldenCapsule && (
              <button
                onClick={handleSaveGolden}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 transition cursor-pointer shadow-2xs"
                title="Save as a starred Golden Prompt capsule in your library"
              >
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>Save as Golden Prompt</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            <button
              onClick={handleInject}
              disabled={isInjecting}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer shadow-md ${
                injectSuccess
                  ? "bg-emerald-600"
                  : isInjecting
                  ? "bg-amber-500 cursor-wait"
                  : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
              }`}
            >
              {injectSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Injected!</span>
                </>
              ) : isInjecting ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Injecting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Inject Cooked Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

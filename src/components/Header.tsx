import React from "react";
import { Plus, Sparkles, Database, Cpu, MessageSquare } from "lucide-react";

interface HeaderProps {
  onNewCapsule: () => void;
  onOpenImportExport: () => void;
  onCaptureCurrentTab: () => void;
  isCapturing: boolean;
  totalCapsules: number;
  totalMessages?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNewCapsule,
  onOpenImportExport,
  onCaptureCurrentTab,
  isCapturing,
  totalCapsules,
  totalMessages
}) => {
  return (
    <header className="sticky top-0 z-20 bg-white/96 backdrop-blur-md border-b border-slate-200/80">
      {/* Main header row */}
      <div className="flex items-center justify-between px-3 pt-2 pb-2">
        {/* Logo + Branding */}
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-300/40 shrink-0">
            <Cpu className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-white animate-pulse-dot" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-extrabold text-slate-900 tracking-tight leading-none">
                PromptWarp
              </h1>
              <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-2xs">
                PRO
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-500 font-medium">
                {totalCapsules} {totalCapsules === 1 ? "capsule" : "capsules"}
              </span>

              {totalMessages !== undefined && totalMessages > 0 && (
                <>
                  <span className="w-px h-2.5 bg-slate-200" />
                  <span
                    title="Total conversation turns across all saved chats"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600"
                  >
                    <MessageSquare className="w-2.5 h-2.5 fill-indigo-500 text-indigo-500" />
                    <span>{totalMessages} {totalMessages === 1 ? "turn" : "turns"}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Capture */}
          <button
            onClick={onCaptureCurrentTab}
            disabled={isCapturing}
            title="Extract chat context from current tab"
            className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              isCapturing
                ? "bg-indigo-50 text-indigo-600 border-indigo-200 cursor-wait"
                : "bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border-slate-200 hover:border-indigo-200"
            }`}
          >
            {isCapturing ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span className="hidden sm:inline">Capturing…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Capture</span>
              </>
            )}
          </button>

          {/* Backup / IO */}
          <button
            onClick={onOpenImportExport}
            title="Import / Export capsules"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
          </button>

          {/* New Capsule */}
          <button
            onClick={onNewCapsule}
            title="Create new capsule (Ctrl+N)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white shadow-md shadow-indigo-300/50 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Gradient accent line */}
      <div className="header-accent" />
    </header>
  );
};

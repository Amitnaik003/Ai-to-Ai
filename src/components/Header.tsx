import React from "react";
import { Plus, Sparkles, Database, Zap, Cpu } from "lucide-react";
import { formatTokenCount } from "../utils/tokenOptimizer";

interface HeaderProps {
  onNewCapsule: () => void;
  onOpenImportExport: () => void;
  onCaptureCurrentTab: () => void;
  isCapturing: boolean;
  totalCapsules: number;
  totalTokens?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNewCapsule,
  onOpenImportExport,
  onCaptureCurrentTab,
  isCapturing,
  totalCapsules,
  totalTokens
}) => {
  const isLargeLibrary = (totalTokens ?? 0) > 5000;

  return (
    <header className="sticky top-0 z-20 bg-white/96 backdrop-blur-md border-b border-slate-200/80">
      {/* Main header row */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        {/* Logo + Branding */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-300/40 shrink-0">
            <Cpu className="w-4.5 h-4.5" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse-dot" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold text-slate-900 tracking-tight leading-none">
                Capsule Hub
              </h1>
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm">
                v1
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-slate-500">
                {totalCapsules}{" "}
                <span className="text-slate-400">{totalCapsules === 1 ? "capsule" : "capsules"}</span>
              </span>

              {totalTokens !== undefined && totalTokens > 0 && (
                <>
                  <span className="w-px h-3 bg-slate-200" />
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                      isLargeLibrary ? "text-violet-600" : "text-indigo-500"
                    }`}
                  >
                    <Zap className={`w-3 h-3 ${isLargeLibrary ? "fill-violet-500 text-violet-500" : "fill-indigo-500 text-indigo-500"}`} />
                    {formatTokenCount(totalTokens)} tokens
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Capture */}
          <button
            onClick={onCaptureCurrentTab}
            disabled={isCapturing}
            title="Extract chat context from current tab"
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              isCapturing
                ? "bg-indigo-50 text-indigo-600 border-indigo-200 cursor-wait"
                : "bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border-slate-200 hover:border-indigo-200"
            }`}
          >
            {isCapturing ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>Capturing…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Capture</span>
              </>
            )}
          </button>

          {/* Backup / IO */}
          <button
            onClick={onOpenImportExport}
            title="Import / Export capsules"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition cursor-pointer"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* New Capsule */}
          <button
            onClick={onNewCapsule}
            title="Create new capsule (Ctrl+N)"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white shadow-md shadow-indigo-300/50 transition-all cursor-pointer"
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

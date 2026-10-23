import React from "react";
import { Plus, Sparkles, Database, Zap } from "lucide-react";
import { formatTokenCount } from "../utils/tokenOptimizer";

interface HeaderProps {
  onNewCapsule: () => void;
  onOpenImportExport: () => void;
  onCaptureCurrentTab: () => void;
  onCompressLibrary?: () => void;
  isCapturing: boolean;
  isCompressing?: boolean;
  totalCapsules: number;
  totalTokens?: number;
  oversizedCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNewCapsule,
  onOpenImportExport,
  onCaptureCurrentTab,
  onCompressLibrary,
  isCapturing,
  isCompressing = false,
  totalCapsules,
  totalTokens,
  oversizedCount = 0
}) => {
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs shadow-indigo-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">Capsule Hub</h1>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <span>{totalCapsules} {totalCapsules === 1 ? "capsule" : "capsules"}</span>
              {totalTokens !== undefined && totalTokens > 0 && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5 text-indigo-600 font-semibold">
                    <Zap className="w-2.5 h-2.5 fill-indigo-600 text-indigo-600" />
                    {formatTokenCount(totalTokens)}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {oversizedCount > 0 && onCompressLibrary && (
            <button
              onClick={onCompressLibrary}
              disabled={isCompressing}
              title={`Compress ${oversizedCount} oversized capsule(s) down to compact Smart Capsules (-90% tokens)`}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition animate-pulse cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span className="hidden sm:inline">{isCompressing ? "Compressing..." : `Compress (${oversizedCount})`}</span>
            </button>
          )}

          <button
            onClick={onCaptureCurrentTab}
            disabled={isCapturing}
            title="Extract chat from current active tab"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isCapturing
                ? "bg-amber-100 text-amber-800 animate-pulse cursor-wait"
                : "bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">{isCapturing ? "Capturing..." : "Capture"}</span>
          </button>

          <button
            onClick={onOpenImportExport}
            title="Backup, export, or import capsules JSON"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent transition cursor-pointer"
          >
            <Database className="w-4 h-4" />
          </button>

          <button
            onClick={onNewCapsule}
            title="Create new prompt capsule"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-300 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </div>
    </header>
  );
};

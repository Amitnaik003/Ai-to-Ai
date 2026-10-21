import React from "react";
import { Plus, Download, Sparkles, Database } from "lucide-react";

interface HeaderProps {
  onNewCapsule: () => void;
  onOpenImportExport: () => void;
  onCaptureCurrentTab: () => void;
  isCapturing: boolean;
  totalCapsules: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNewCapsule,
  onOpenImportExport,
  onCaptureCurrentTab,
  isCapturing,
  totalCapsules
}) => {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">Capsule Hub</h1>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {totalCapsules} context {totalCapsules === 1 ? "capsule" : "capsules"} saved
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onCaptureCurrentTab}
            disabled={isCapturing}
            title="Extract chat from current active tab"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              isCapturing
                ? "bg-amber-100 text-amber-800 animate-pulse"
                : "bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isCapturing ? "Capturing..." : "Capture"}</span>
          </button>

          <button
            onClick={onOpenImportExport}
            title="Export / Import Capsules JSON"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent transition"
          >
            <Database className="w-4 h-4" />
          </button>

          <button
            onClick={onNewCapsule}
            title="Create new prompt capsule"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-300 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </div>
    </header>
  );
};

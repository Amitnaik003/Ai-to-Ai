import React, { useState } from "react";
import { X, Download, Upload, FileText, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import type { Capsule, Folder } from "../types";

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  capsules: Capsule[];
  folders: Folder[];
  onExport: () => Promise<string>;
  onImport: (json: string) => Promise<{ importedCount: number }>;
  onClearAll: () => Promise<void>;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  capsules,
  folders,
  onExport,
  onImport,
  onClearAll,
  onShowToast
}) => {
  const [importJsonText, setImportJsonText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      const json = await onExport();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `capsule-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onShowToast("Backup downloaded successfully!", "success");
    } catch (err: any) {
      onShowToast(err.message || "Failed to export data", "error");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        await executeImport(content);
      } catch (err: any) {
        onShowToast(err.message || "Invalid backup file", "error");
      }
    };
    reader.readAsText(file);
  };

  const executeImport = async (textToImport: string) => {
    if (!textToImport.trim()) return;
    setIsProcessing(true);
    try {
      const res = await onImport(textToImport);
      onShowToast(`Imported ${res.importedCount} new capsules!`, "success");
      setImportJsonText("");
      onClose();
    } catch (err: any) {
      onShowToast(err.message || "Failed to parse import data", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Download className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Library Tools & Backup</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* Export Box */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              Export Capsule Library
            </h3>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Export all {capsules.length} context capsules and {folders.length} folders to a portable JSON backup.
            </p>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON Backup</span>
            </button>
          </div>

          {/* Import Box */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              Import Capsules
            </h3>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Upload a previously exported JSON backup file or paste JSON below.
            </p>

            <label className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs transition mb-2">
              <Upload className="w-3.5 h-3.5" />
              <span>Choose Backup File (.json)</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>

            <textarea
              rows={3}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Or paste JSON payload directly..."
              className="w-full px-2.5 py-1.5 text-[11px] font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            {importJsonText.trim() && (
              <button
                onClick={() => executeImport(importJsonText)}
                disabled={isProcessing}
                className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition"
              >
                {isProcessing ? "Importing..." : "Parse & Import Pasted JSON"}
              </button>
            )}
          </div>

          {/* Danger Zone: Clear All Capsules */}
          {capsules.length > 0 && (
            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/80">
              <h3 className="text-xs font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                Clear All Capsules
              </h3>
              <p className="text-[11px] text-rose-600/80 mb-2">
                Permanently delete all {capsules.length} saved capsules from your local library.
              </p>
              <button
                onClick={async () => {
                  if (window.confirm("Are you sure you want to delete ALL saved capsules? This cannot be undone.")) {
                    await onClearAll();
                    onShowToast("All capsules have been cleared!", "info");
                    onClose();
                  }
                }}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All Capsules</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

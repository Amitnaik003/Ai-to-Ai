import React from "react";
import { Search, X, Pin, Folder as FolderIcon, Award } from "lucide-react";
import type { CapsuleFilter, Folder, PlatformType } from "../types";

interface SearchBarProps {
  filter: CapsuleFilter;
  folders: Folder[];
  onFilterChange: (updated: Partial<CapsuleFilter>) => void;
}

const PLATFORM_OPTIONS: {
  id: "all" | PlatformType;
  label: string;
  dot: string;
  activeBg: string;
  activeText: string;
}[] = [
  { id: "all",        label: "All",        dot: "bg-slate-400",   activeBg: "bg-indigo-600",  activeText: "text-white" },
  { id: "chatgpt",    label: "ChatGPT",    dot: "bg-emerald-500", activeBg: "bg-emerald-600", activeText: "text-white" },
  { id: "claude",     label: "Claude",     dot: "bg-amber-500",   activeBg: "bg-amber-500",   activeText: "text-white" },
  { id: "gemini",     label: "Gemini",     dot: "bg-indigo-500",  activeBg: "bg-indigo-600",  activeText: "text-white" },
  { id: "perplexity", label: "Perplexity", dot: "bg-cyan-600",    activeBg: "bg-cyan-600",    activeText: "text-white" },
  { id: "deepseek",   label: "DeepSeek",   dot: "bg-blue-600",    activeBg: "bg-blue-600",    activeText: "text-white" },
  { id: "gmail",      label: "Gmail",      dot: "bg-rose-500",    activeBg: "bg-rose-600",    activeText: "text-white" },
  { id: "manual",     label: "Custom",     dot: "bg-slate-400",   activeBg: "bg-slate-600",   activeText: "text-white" },
];

export const SearchBar: React.FC<SearchBarProps> = ({ filter, folders, onFilterChange }) => {
  return (
    <div className="bg-white border-b border-slate-200/80 px-3 pt-2.5 pb-2 space-y-2">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={filter.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="Search capsules, tags, summaries…"
          className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg
                     hover:bg-white focus:bg-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400
                     placeholder:text-slate-400 text-slate-800 transition-all"
        />
        {filter.search && (
          <button
            onClick={() => onFilterChange({ search: "" })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Platform Filter Pills */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {PLATFORM_OPTIONS.map((item) => {
          const isSelected = filter.platform === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onFilterChange({ platform: item.id })}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                isSelected
                  ? `${item.activeBg} ${item.activeText} border-transparent shadow-sm`
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? "bg-white/80" : item.dot}`} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Folder + Pinned + Golden Filter row */}
      <div className="flex items-center justify-between text-xs pt-0.5">
        {/* Folder select */}
        <div className="flex items-center gap-1.5 text-slate-500">
          <FolderIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={filter.folderId}
            onChange={(e) => onFilterChange({ folderId: e.target.value })}
            className="text-[11px] bg-transparent text-slate-600 font-medium focus:outline-none cursor-pointer hover:text-indigo-600 transition"
          >
            <option value="all">All Folders</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Toggles: Golden + Pinned */}
        <div className="flex items-center gap-1">
          {/* Golden Prompts filter */}
          <button
            onClick={() => onFilterChange({ goldenOnly: !filter.goldenOnly })}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg transition-all cursor-pointer font-medium border ${
              filter.goldenOnly
                ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs font-bold"
                : "text-slate-500 hover:text-amber-800 hover:bg-amber-50 border-transparent"
            }`}
            title="Filter by Tilantra Golden Prompts"
          >
            <Award className={`w-3 h-3 ${filter.goldenOnly ? "fill-amber-500 text-amber-700" : "text-slate-400"}`} />
            <span>Golden</span>
          </button>

          {/* Pinned toggle */}
          <button
            onClick={() => onFilterChange({ pinnedOnly: !filter.pinnedOnly })}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg transition-all cursor-pointer font-medium border ${
              filter.pinnedOnly
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "text-slate-500 hover:text-amber-700 hover:bg-amber-50 border-transparent"
            }`}
          >
            <Pin className={`w-3 h-3 ${filter.pinnedOnly ? "fill-amber-500 text-amber-500" : "text-slate-400"}`} />
            <span>Pinned</span>
          </button>
        </div>
      </div>
    </div>
  );
};

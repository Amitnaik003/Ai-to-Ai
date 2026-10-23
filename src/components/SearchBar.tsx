import React from "react";
import { Search, X, Pin, Folder as FolderIcon, Filter } from "lucide-react";
import type { CapsuleFilter, Folder, PlatformType } from "../types";

interface SearchBarProps {
  filter: CapsuleFilter;
  folders: Folder[];
  onFilterChange: (updated: Partial<CapsuleFilter>) => void;
}

const PLATFORM_OPTIONS: { id: "all" | PlatformType; label: string; badge: string }[] = [
  { id: "all", label: "All", badge: "bg-slate-100 text-slate-700" },
  { id: "chatgpt", label: "ChatGPT", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "claude", label: "Claude", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "gemini", label: "Gemini", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "gmail", label: "Gmail", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "manual", label: "Custom", badge: "bg-slate-50 text-slate-700 border-slate-200" }
];

export const SearchBar: React.FC<SearchBarProps> = ({
  filter,
  folders,
  onFilterChange
}) => {
  return (
    <div className="p-3 bg-white border-b border-slate-100 space-y-2.5">
      {/* Search Input Box */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filter.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="Search capsules, tags, summaries..."
          className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
        />
        {filter.search && (
          <button
            onClick={() => onFilterChange({ search: "" })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Platform Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
        {PLATFORM_OPTIONS.map((item) => {
          const isSelected = filter.platform === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onFilterChange({ platform: item.id })}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all border ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/80"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Sub-bar: Folder & Pinned Filter */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-500">
          <FolderIcon className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filter.folderId}
            onChange={(e) => onFilterChange({ folderId: e.target.value })}
            className="text-[11px] bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer hover:text-indigo-600"
          >
            <option value="all">All Folders</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => onFilterChange({ pinnedOnly: !filter.pinnedOnly })}
          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition ${
            filter.pinnedOnly
              ? "bg-amber-100 text-amber-800 font-semibold"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Pin className={`w-3 h-3 ${filter.pinnedOnly ? "fill-amber-600 text-amber-600" : ""}`} />
          <span>Pinned</span>
        </button>
      </div>
    </div>
  );
};
